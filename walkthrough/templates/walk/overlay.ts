// The walk's overlay — the strip at the bottom of the page, the ring on the control about to be touched,
// and the steps list. Injected as an init script, so it is rebuilt on every navigation and reload from
// what it keeps in sessionStorage (a sign-out reload keeps the question standing and its answer).
//
// Three things keep it out of the app's and the walk's way:
//   • a **closed** shadow root on a 0×0 host with no attributes — locators, text reads and
//     `querySelectorAll` never enter it, so drawing on the strip is not a change on the app's screen;
//   • `pointer-events: none` on the strip while the walk acts, so a click at a control's coordinates is
//     never taken by the strip; only the buttons take the pointer. While "Next" waits the whole strip takes
//     it, so its text can be selected and copied;
//   • it draws in the top document only — an iframe gets the init script too and would draw a second strip.
//
// What it draws (words from the dictionary, direction from the config):
//   strip   — who is signed in, the section, the title line (before / after / change of user), the
//             description, the result, the scroll line; the buttons in a row of their own under the text:
//             "Next" and "Continue automatically" (a second press within 3 s confirms); a row always shown:
//             the mode (step by step / waiting) or "Pause" on auto, and "Steps" (the list, any time);
//             while "Next" waits: "Back", "Return here" and the line saying where the screen stands;
//             ▾ folds the strip to a tab, the tab opens it again.
//   fade    — the strip at opacity 0.1 while the walk acts, 1 under the mouse and 1 while "Next" waits.
//   ring    — a red rectangle on an element, following it every frame while it or a box around it moves,
//             gone when it leaves the page.
//   list    — the steps, grouped by section; pickable once at the start, read-only after, current marked.
//
// Written as a string, not a function: tsx/esbuild rewrite named functions into `__name(...)` calls,
// which do not exist in the page; a string reaches the page exactly as written. Inside it: no backticks
// and no dollar-brace, because the whole script is one template literal.
import type { Direction } from './types';
import type { OverlayWords } from './dictionary';

/** The overlay's api on `window.__walkGuide`, as the runner and controls.ts call it. */
export interface GuideApi {
  show(view: { who: string; section: string; title: string; caption: string }): void;
  result(text: string, failed: boolean): void;
  scroll(text: string, failed: boolean): void;
  place(text: string, failed: boolean): void;
  ask(id: string, withAuto: boolean): void;
  pressNext(): void;
  answered(): string;
  mode(): 'auto' | 'wait';
  setMode(mode: 'auto' | 'wait'): void;
  pressAuto(): void;
  list(id: string, title: string, options: ListOption[], pickable: boolean): void;
  toggleList(): void;
  choose(value: string): void;
  picked(id: string): string;
  current(value: string): void;
  unfollow(): void;
  pendingRequest(): { seq: number; kind: 'back' | 'here' } | null;
  takeRequest(seq: number): void;
  fold(folded: boolean): void;
  state(): GuideState;
}

/** A row of the steps list. `value` is the step's number, '' for a step listed but not choosable. */
export interface ListOption {
  value: string;
  section: string;
  mark: string;
  label: string;
}

/** What is drawn now, in numbers — read by checks of the walk itself. */
export interface GuideState {
  title: string;
  waiting: boolean;
  mode: 'auto' | 'wait';
  stripOpacity: number;
  stripSelectable: boolean;
  listOpen: boolean;
  folded: boolean;
  ringShown: boolean;
}

export const walkOverlayScript = (look: { direction: Direction; words: OverlayWords; fade: boolean }): string => String.raw`
(() => {
  if (window.__walkGuide || window.top !== window) return;
  const WORDS = ${JSON.stringify(look.words)};
  const DIRECTION = ${JSON.stringify(look.direction)};
  const FADE = ${JSON.stringify(look.fade)};
  const CONFIRM_MS = 3000;
  const KEY = 'walk.guide.';
  const FONT = '"Segoe UI", Arial, sans-serif';
  const STYLE = [
    ':host { all: initial; }',
    '.strip { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); max-width: 82vw; min-width: 320px;',
    '  background: rgba(15, 23, 42, 0.94); color: #fff; border-radius: 12px; padding: 10px 40px 10px 40px;',
    '  font: 600 20px/1.35 ' + FONT + '; text-align: center; box-shadow: 0 6px 24px rgba(0,0,0,.35);',
    '  pointer-events: none; user-select: none; z-index: 2147483647; transition: opacity .15s ease; }',
    '.strip[hidden], .strip.folded { display: none; }',
    '.strip.faded { opacity: .1; }',
    '.strip.faded.near, .strip.faded.waiting { opacity: 1; }',
    '.strip.waiting { pointer-events: auto; user-select: text; cursor: text; }',
    '.who { display: block; font-size: 16px; font-weight: 700; color: #fbbf24; }',
    '.section { display: block; font-size: 15px; color: #6ee7b7; }',
    '.title { display: block; font-size: 17px; color: #93c5fd; margin: 2px 0; }',
    '.caption { display: block; font-weight: 500; }',
    '.result { display: block; font-size: 18px; font-weight: 700; margin-top: 4px; }',
    '.result.done { color: #86efac; } .result.failed { color: #fca5a5; }',
    '.scroll { display: block; font-size: 15px; color: #e2e8f0; } .scroll.failed { color: #fca5a5; }',
    '.result:empty, .scroll:empty, .section:empty, .who:empty { display: none; }',
    '.row { display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap; }',
    '.row[hidden] { display: none; }',
    'button { pointer-events: auto; cursor: pointer; font-family: ' + FONT + '; }',
    'button[hidden] { display: none; }',
    '.next { padding: 8px 34px; border: 0; border-radius: 10px; background: #22c55e; color: #0f172a; font-size: 21px; font-weight: 800; }',
    '.auto { padding: 8px 16px; border: 2px solid #93c5fd; border-radius: 10px; background: transparent; color: #93c5fd; font-size: 17px; font-weight: 700; }',
    '.auto.confirm { background: #93c5fd; color: #0f172a; }',
    '.mode { font-size: 14px; color: #cbd5e1; }',
    '.pause { padding: 4px 14px; border: 0; border-radius: 8px; background: #f59e0b; color: #0f172a; font-size: 15px; font-weight: 800; }',
    '.small { padding: 4px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: transparent; color: #e2e8f0; font-size: 14px; font-weight: 600; }',
    '.where { font-size: 14px; color: #cbd5e1; } .where.failed { color: #fca5a5; }',
    '.fold { position: absolute; top: 4px; inset-inline-end: 6px; width: 26px; height: 22px; padding: 0; border: 0; border-radius: 6px;',
    '  background: rgba(255,255,255,.12); color: #e2e8f0; font-size: 14px; font-weight: 700; }',
    '.tab { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); padding: 5px 18px; border: 0;',
    '  border-radius: 10px 10px 0 0; background: rgba(15, 23, 42, 0.94); color: #fbbf24; font-size: 15px; font-weight: 700;',
    '  z-index: 2147483647; }',
    '.list { position: fixed; top: 3vh; left: 50%; transform: translateX(-50%); width: min(960px, 94vw); max-height: 66vh;',
    '  overflow-y: auto; background: rgba(15, 23, 42, 0.97); color: #fff; border-radius: 14px; padding: 14px 18px;',
    '  font: 500 16px/1.35 ' + FONT + '; box-shadow: 0 10px 34px rgba(0,0,0,.45); pointer-events: auto; user-select: text;',
    '  z-index: 2147483647; }',
    '.list[hidden] { display: none; }',
    '.list .heading { font-size: 20px; font-weight: 800; color: #fbbf24; margin-bottom: 6px; }',
    '.list .group { font-size: 15px; font-weight: 700; color: #6ee7b7; margin: 10px 0 4px; }',
    '.list .item { display: block; width: 100%; box-sizing: border-box; text-align: start; margin: 2px 0; padding: 6px 10px;',
    '  border: 0; border-radius: 8px; background: rgba(255,255,255,.06); color: #fff; font: inherit; }',
    '.list button.item:hover { background: #22c55e; color: #0f172a; }',
    '.list .item.off { color: #94a3b8; } .list .item.now { outline: 2px solid #fbbf24; }',
    '.list .item b { display: inline-block; min-width: 72px; color: #93c5fd; }',
    '.ring { position: fixed; border: 3px solid #ef4444; border-radius: 8px; pointer-events: none; z-index: 2147483646;',
    '  box-shadow: 0 0 0 4px rgba(239,68,68,.25); }',
    '.ring[hidden] { display: none; }',
  ].join('\n');

  // What is shown, kept in sessionStorage so a reload redraws it. A write that fails throws to the caller:
  // a page that cannot keep the question would lose it on a reload and leave the runner waiting forever.
  const NAMES = ['view', 'result', 'scroll', 'place', 'asked', 'answered', 'mode', 'list', 'picked', 'current', 'folded', 'request', 'seq'];
  const shown = {};
  for (const name of NAMES) {
    const kept = sessionStorage.getItem(KEY + name);
    shown[name] = kept === null ? null : JSON.parse(kept);
  }
  if (shown.mode !== 'auto') shown.mode = 'wait';
  const set = (name, value) => {
    shown[name] = value;
    if (value === null) sessionStorage.removeItem(KEY + name);
    else sessionStorage.setItem(KEY + name, JSON.stringify(value));
  };

  let parts = null;
  let confirmUntil = 0;
  let confirmTimer = 0;
  let drawnList = '';
  const make = (tag, className, text) => {
    const made = document.createElement(tag);
    if (className) made.className = className;
    if (text) made.textContent = text;
    if (tag === 'button') made.type = 'button';
    return made;
  };
  const build = () => {
    if (parts || !document.body) return parts;
    const host = document.createElement('walk-overlay');
    host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    const style = make('style', '', STYLE);
    const strip = make('div', 'strip');
    strip.dir = DIRECTION;
    const p = {
      root, strip, who: make('span', 'who'), section: make('span', 'section'), title: make('span', 'title'),
      caption: make('span', 'caption'), result: make('span', 'result'), scroll: make('span', 'scroll'),
      buttons: make('div', 'row buttons'), next: make('button', 'next', WORDS.next), auto: make('button', 'auto', WORDS.auto),
      always: make('div', 'row always'), mode: make('span', 'mode'), pause: make('button', 'pause', WORDS.pause),
      listButton: make('button', 'small', WORDS.stepsList),
      places: make('div', 'row places'), back: make('button', 'small', WORDS.back), here: make('button', 'small', WORDS.here),
      where: make('span', 'where'), fold: make('button', 'fold', '▾'), tab: make('button', 'tab'),
      list: make('div', 'list'), ring: make('div', 'ring'),
    };
    p.fold.title = WORDS.fold;
    p.tab.dir = DIRECTION;
    p.list.dir = DIRECTION;
    p.buttons.append(p.next, p.auto);
    p.always.append(p.mode, p.pause, p.listButton);
    p.places.append(p.back, p.here, p.where);
    strip.append(p.fold, p.who, p.section, p.title, p.caption, p.result, p.scroll, p.buttons, p.always, p.places);
    root.append(style, p.ring, strip, p.tab, p.list);
    document.documentElement.appendChild(host);
    p.next.addEventListener('click', () => guide.pressNext());
    p.auto.addEventListener('click', () => guide.pressAuto());
    p.pause.addEventListener('click', () => guide.setMode('wait'));
    p.listButton.addEventListener('click', () => guide.toggleList());
    p.back.addEventListener('click', () => askFor('back'));
    p.here.addEventListener('click', () => askFor('here'));
    p.fold.addEventListener('click', () => guide.fold(true));
    p.tab.addEventListener('click', () => guide.fold(false));
    parts = p;
    if (FADE) fadeTheStrip(p);
    redraw();
    return parts;
  };

  // The strip at 0.1 until the mouse is over it. Mouse events are composed, so this capture listener hears
  // a move over a button inside the shadow root as well as one over the app.
  const fadeTheStrip = (p) => {
    p.strip.classList.add('faded');
    const near = (x, y) => {
      const r = p.strip.getBoundingClientRect();
      p.strip.classList.toggle('near', r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
    };
    document.addEventListener('mousemove', (event) => near(event.clientX, event.clientY), { capture: true, passive: true });
    document.addEventListener('mouseout', (event) => { if (!event.relatedTarget) near(-1, -1); }, { capture: true, passive: true });
  };

  const askFor = (kind) => {
    const seq = (shown.seq || 0) + 1;
    set('seq', seq);
    set('request', { seq, kind });
    guide.place(kind === 'back' ? WORDS.movingBack : WORDS.returning, false);
  };

  const redraw = () => {
    const p = parts;
    if (!p) return;
    const view = shown.view || { who: '', section: '', title: '', caption: '' };
    p.who.textContent = view.who;
    p.section.textContent = view.section;
    p.title.textContent = view.title;
    p.caption.textContent = view.caption;
    p.result.textContent = shown.result ? shown.result.text : '';
    p.result.className = 'result' + (shown.result ? (shown.result.failed ? ' failed' : ' done') : '');
    p.scroll.textContent = shown.scroll ? shown.scroll.text : '';
    p.scroll.className = 'scroll' + (shown.scroll && shown.scroll.failed ? ' failed' : '');
    const asked = shown.asked;
    const waiting = !!asked && shown.mode === 'wait';
    const confirming = Date.now() < confirmUntil;
    p.buttons.hidden = !asked;
    p.auto.hidden = !(asked && asked.withAuto);
    p.auto.textContent = confirming ? WORDS.confirmAuto : WORDS.auto;
    p.auto.classList.toggle('confirm', confirming);
    // The pause control stands on the strip in both modes: on auto the button, step by step the mode.
    p.pause.hidden = shown.mode !== 'auto';
    p.mode.hidden = shown.mode === 'auto';
    p.mode.textContent = waiting ? WORDS.modeWaiting : WORDS.modeStepByStep;
    p.listButton.hidden = !shown.list;
    p.places.hidden = !waiting;
    p.where.textContent = shown.place ? shown.place.text : '';
    p.where.className = 'where' + (shown.place && shown.place.failed ? ' failed' : '');
    p.strip.classList.toggle('waiting', waiting);
    p.strip.classList.toggle('folded', !!shown.folded);
    p.tab.hidden = !shown.folded;
    p.tab.textContent = waiting ? WORDS.foldedTabWaiting : WORDS.foldedTab;
    p.strip.hidden = !view.who && !view.title && !view.caption && !asked && !shown.result;
    drawList();
  };

  // The steps list: a heading per section, a row per step. Pickable rows are buttons; afterwards read only.
  const drawList = () => {
    const p = parts;
    const list = shown.list;
    p.list.hidden = !list || !list.open;
    if (!list) { drawnList = ''; return; }
    const signature = list.id + '|' + list.pickable + '|' + (shown.current || '');
    if (drawnList === signature) return;
    drawnList = signature;
    p.list.textContent = '';
    p.list.appendChild(make('div', 'heading', list.title));
    let group = null;
    for (const option of list.options) {
      if (option.section !== group) { group = option.section; p.list.appendChild(make('div', 'group', group)); }
      const pickable = list.pickable && option.value !== '';
      const now = !list.pickable && option.value !== '' && option.value === shown.current;
      const row = make(pickable ? 'button' : 'div', 'item' + (option.value === '' ? ' off' : '') + (now ? ' now' : ''));
      if (pickable) row.addEventListener('click', () => guide.choose(option.value));
      row.appendChild(make('b', '', now ? WORDS.currentMark : option.mark));
      row.appendChild(document.createTextNode(option.label));
      p.list.appendChild(row);
    }
  };

  // The ring on an element that may be moving: re-measured every frame while it, or a box around it, runs a
  // CSS animation or transition; hidden the moment it leaves the page, so an empty frame is never left standing.
  const following = { frame: 0, gone: null };
  const stopFollowing = () => {
    if (following.frame) cancelAnimationFrame(following.frame);
    following.frame = 0;
    if (following.gone) following.gone.disconnect();
    following.gone = null;
  };
  const isMoving = (element) => {
    for (let node = element; node && node.getAnimations; node = node.parentElement) {
      if (node.getAnimations().some((one) => one.playState === 'running')) return true;
    }
    return false;
  };

  const guide = {
    show(view) { set('view', view); build(); redraw(); },
    result(text, failed) { set('result', text ? { text, failed: !!failed } : null); build(); redraw(); },
    scroll(text, failed) { set('scroll', text ? { text, failed: !!failed } : null); build(); redraw(); },
    place(text, failed) { set('place', text ? { text, failed: !!failed } : null); build(); redraw(); },
    /** Draw "Next" under this id — one id per question; the runner waits until answered() returns it. */
    ask(id, withAuto) { set('asked', { id, withAuto: !!withAuto }); set('place', null); build(); redraw(); },
    pressNext() {
      if (!shown.asked) throw new Error('Next was pressed with no question standing');
      set('answered', shown.asked.id);
      set('asked', null);
      build(); redraw();
    },
    answered() { return shown.answered || ''; },
    mode() { return shown.mode; },
    setMode(mode) {
      if (mode !== 'auto' && mode !== 'wait') throw new Error('the walk mode is auto or wait, not ' + mode);
      set('mode', mode); build(); redraw();
    },
    /** The first press arms a 3-second confirm; a second press inside it switches to auto and answers "Next". */
    pressAuto() {
      clearTimeout(confirmTimer);
      if (Date.now() < confirmUntil) {
        confirmUntil = 0;
        guide.setMode('auto');
        if (shown.asked) guide.pressNext();
        return;
      }
      confirmUntil = Date.now() + CONFIRM_MS;
      confirmTimer = setTimeout(() => { confirmUntil = 0; redraw(); }, CONFIRM_MS);
      redraw();
    },
    list(id, title, options, pickable) { set('list', { id, title, options, pickable: !!pickable, open: !!pickable }); build(); redraw(); },
    toggleList() {
      if (!shown.list || shown.list.pickable) return;
      set('list', Object.assign({}, shown.list, { open: !shown.list.open })); build(); redraw();
    },
    choose(value) {
      if (!shown.list || !shown.list.pickable) throw new Error('a start step was chosen with no pickable list standing');
      set('picked', { id: shown.list.id, value: String(value) });
      set('list', Object.assign({}, shown.list, { pickable: false, open: false }));
      build(); redraw();
    },
    picked(id) { return shown.picked && shown.picked.id === id ? shown.picked.value : ''; },
    current(value) { set('current', String(value)); build(); redraw(); },
    follow(control) {
      const p = build();
      if (!p) throw new Error('the walk overlay has no body to draw the ring on yet');
      stopFollowing();
      // A control drawn at no size (a file input behind its label) rings the nearest box around it that has one.
      let element = control;
      while (element.parentElement && element.getBoundingClientRect().width === 0) element = element.parentElement;
      const place = () => {
        const r = element.getBoundingClientRect();
        p.ring.hidden = false;
        p.ring.style.left = (r.x - 4) + 'px'; p.ring.style.top = (r.y - 4) + 'px';
        p.ring.style.width = (r.width + 8) + 'px'; p.ring.style.height = (r.height + 8) + 'px';
      };
      place();
      if (isMoving(element)) {
        const step = () => {
          following.frame = 0;
          if (!element.isConnected) return;
          place();
          if (isMoving(element)) following.frame = requestAnimationFrame(step);
        };
        following.frame = requestAnimationFrame(step);
      }
      following.gone = new MutationObserver(() => {
        if (element.isConnected) return;
        p.ring.hidden = true;
        stopFollowing();
      });
      following.gone.observe(document.documentElement, { childList: true, subtree: true });
    },
    unfollow() { const p = build(); if (!p) return; stopFollowing(); p.ring.hidden = true; },
    pendingRequest() { return shown.request; },
    takeRequest(seq) { if (shown.request && shown.request.seq === seq) set('request', null); },
    fold(folded) { set('folded', !!folded); build(); redraw(); },
    state() {
      const p = build();
      if (!p) throw new Error('the walk overlay is not built yet');
      return {
        title: p.title.textContent || '', waiting: p.strip.classList.contains('waiting'), mode: shown.mode,
        stripOpacity: Number(getComputedStyle(p.strip).opacity), stripSelectable: getComputedStyle(p.strip).userSelect === 'text',
        listOpen: !p.list.hidden, folded: !!shown.folded, ringShown: !p.ring.hidden,
      };
    },
  };
  window.__walkGuide = guide;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, { once: true });
  else build();
})();
`;
