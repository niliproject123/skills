// The guide overlay — what a viewer sees drawn over the app: a full-screen title card when a
// chapter begins, a strip at the bottom with whose screen this is, the step and the current action,
// and a pointer with a ring that moves to the control about to be pressed.
//
// The card and the strip carry different lengths of text on purpose. The card is held three
// seconds and fades in and out, so it may carry a long heading, the people and the chapter's notes.
// The strip is read in a glance while the screen keeps moving, so each side note on it is one
// phrase, held to a single non-wrapping line by the stylesheet.
//
// Injected by `recorder.ts` as an init script, only while a video is being recorded. Three things
// keep it out of the scenario's way, and each matters:
//   • `pointer-events: none` everywhere — `elementFromPoint` skips it, no click lands on it;
//   • a **closed** shadow root — `querySelectorAll`, text reads and locators never enter it;
//   • the host carries no attribute and is 0×0 — a DOM scan sees one empty element that never changes.
// Masking uses `adoptedStyleSheets` and the CSS highlight registry: no node is added to the app's
// DOM and no text of the app is changed — only how it is painted.
//
// The page script is a string, not a function: tsx rewrites named functions inside a page script
// into `__name(...)`, and a string reaches the page exactly as written.

/** Every colour the overlay draws with. The defaults are the look the tools were built with. */
export interface Colours {
  strip: string;
  card: string;
  text: string;
  person: string;
  subtitle: string;
  step: string;
  sideNote: string;
  slideNote: string;
  pointer: string;
  mask: string;
}

export const DEFAULT_COLOURS: Colours = {
  strip: 'rgba(15, 23, 42, 0.92)',
  card: 'rgba(15, 23, 42, 0.94)',
  text: '#fff',
  person: '#fbbf24',
  subtitle: '#6ee7b7',
  step: '#93c5fd',
  sideNote: '#fcd34d',
  slideNote: '#cbd5e1',
  pointer: '#ef4444',
  mask: '#94a3b8',
};

export const DEFAULT_FONT = '"Segoe UI", Arial, sans-serif';

/** What the overlay needs to know about this project — built by the recorder from the settings. */
export interface Look {
  direction: 'rtl' | 'ltr';
  font: string;
  colours: Colours;
  /** A data: address of the logo, drawn above the card's heading; null for none. */
  logo: string | null;
  /** Written before the people on the card: `People: `. */
  peopleLabel: string;
  masking: { fields: string[]; patterns: ('email' | 'phone')[] };
}

/** The global the page script defines; the recorder and the self-check reach the overlay through it. */
export const OVERLAY_GLOBAL = '__scenarioVideoOverlay';
/** The sessionStorage key prefix — the step, the caption, the person survive a reload. */
export const STORAGE_PREFIX = 'scenario-video.';
/** The card's fade, in the stylesheet below; `recorder.ts` waits exactly this long after a fade out. */
export const CARD_FADE_SECONDS = 0.35;

function styleFor(look: Look): string {
  const c = look.colours;
  const tint = (colour: string, percent: number): string => `color-mix(in srgb, ${colour} ${percent}%, transparent)`;
  return [
    ':host { all: initial; }',
    `.strip { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); max-width: 80vw;`,
    `  background: ${c.strip}; color: ${c.text}; border-radius: 12px; padding: 10px 22px;`,
    `  font: 600 22px/1.35 ${look.font}; direction: ${look.direction}; text-align: center;`,
    '  box-shadow: 0 6px 24px rgba(0,0,0,.35); pointer-events: none; z-index: 2147483647; }',
    '.strip[hidden] { display: none; }',
    `.strip .who { display: block; font-size: 17px; font-weight: 700; color: ${c.person}; margin-bottom: 1px; }`,
    `.strip .subtitle { display: block; font-size: 16px; font-weight: 600; color: ${c.subtitle}; margin-bottom: 1px; }`,
    `.strip .step { display: block; font-size: 15px; font-weight: 500; color: ${c.step}; margin-bottom: 2px; }`,
    // One phrase per line, enforced here: a side note that grew into a sentence is cut with an
    // ellipsis instead of wrapping the strip into a paragraph (the recorder also logs it).
    '.strip .sides span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 76vw;',
    `  font-size: 16px; font-weight: 600; color: ${c.sideNote}; }`,
    `.card { position: fixed; inset: 0; background: ${c.card}; color: ${c.text}; display: flex;`,
    `  flex-direction: column; align-items: center; justify-content: center; direction: ${look.direction};`,
    `  font-family: ${look.font}; pointer-events: none; z-index: 2147483647;`,
    `  opacity: 0; transition: opacity ${CARD_FADE_SECONDS}s ease; }`,
    '.card.on { opacity: 1; }',
    // The sheet is measured and the heading shrunk until it fits. flex: 0 0 auto and NO max-height:
    // a shrunk flex item reports a height that fits while its words spill out — the exact
    // measurement the fitting loop relies on.
    '.card .sheet { display: flex; flex-direction: column; align-items: center; justify-content: center;',
    '  gap: 14px; max-width: 86vw; text-align: center; flex: 0 0 auto; }',
    '.card .sheet > * { flex: 0 0 auto; max-width: 86vw; }',
    '.card .logo { max-height: 72px; max-width: 280px; }',
    '.card .logo[hidden] { display: none; }',
    '.card .title { font-size: 54px; font-weight: 700; line-height: 1.22; overflow-wrap: anywhere; }',
    `.card .subtitle { font-size: 30px; font-weight: 600; color: ${c.subtitle}; }`,
    `.card .people { font-size: 25px; font-weight: 600; color: ${c.person}; line-height: 1.35; }`,
    '.card .sides span, .card .notes span { display: block; line-height: 1.4; }',
    `.card .sides span { font-size: 23px; font-weight: 600; color: ${c.sideNote}; }`,
    `.card .notes span { font-size: 20px; color: ${c.slideNote}; }`,
    `.card .who { font-size: 24px; color: ${c.step}; }`,
    '.pointer { position: fixed; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%;',
    `  background: ${tint(c.pointer, 55)}; border: 2px solid #fff; box-shadow: 0 0 0 3px ${tint(c.pointer, 35)};`,
    '  pointer-events: none; z-index: 2147483647; transition: left .45s ease, top .45s ease; }',
    '.pointer[hidden] { display: none; }',
    `.ring { position: fixed; border: 3px solid ${c.pointer}; border-radius: 8px; pointer-events: none;`,
    `  z-index: 2147483646; box-shadow: 0 0 0 4px ${tint(c.pointer, 25)}; transition: all .3s ease; }`,
    '.ring[hidden] { display: none; }',
  ].join('\n');
}

/** The mask's stylesheet, adopted by the document (no DOM node): fields blurred, matched text painted over. */
function maskStyleFor(look: Look): string {
  const fields = [...look.masking.fields];
  if (look.masking.patterns.includes('email')) fields.push('input[type="email"]');
  if (look.masking.patterns.includes('phone')) fields.push('input[type="tel"]');
  return [
    fields.length ? `${fields.join(', ')} { filter: blur(6px) !important; }` : '',
    `::highlight(scenario-video-mask) { color: transparent; background-color: ${look.colours.mask}; }`,
  ].join('\n');
}

export function overlayScript(look: Look): string {
  const settings = {
    look,
    style: styleFor(look),
    maskStyle: maskStyleFor(look),
    global: OVERLAY_GLOBAL,
    prefix: STORAGE_PREFIX,
  };
  return String.raw`
(() => {
  const SETTINGS = ${JSON.stringify(settings)};
  if (window[SETTINGS.global]) return;
  const LOOK = SETTINGS.look;
  const KEYS = { step: SETTINGS.prefix + 'step', caption: SETTINGS.prefix + 'caption', who: SETTINGS.prefix + 'who',
    subtitle: SETTINGS.prefix + 'subtitle', sides: SETTINGS.prefix + 'sides' };

  let parts = null;
  const build = () => {
    if (parts || !document.body) return parts;
    const host = document.createElement('scenario-video-overlay');
    // z-index on the HOST: a fixed element is its own stacking context, so everything the shadow
    // root draws is trapped at the host's level. The maximum puts the overlay above every app layer.
    host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = '<style>' + SETTINGS.style + '</style>' +
      '<div class="ring" hidden></div><div class="pointer" hidden></div>' +
      '<div class="strip" hidden><span class="who"></span><span class="subtitle"></span>' +
      '<span class="sides"></span><span class="step"></span><span class="caption"></span></div>' +
      '<div class="card"><div class="sheet"><img class="logo" hidden alt=""><div class="subtitle"></div><div class="title"></div>' +
      '<div class="people"></div><div class="sides"></div><div class="notes"></div><div class="who"></div></div></div>';
    document.documentElement.appendChild(host);
    const q = (selector) => root.querySelector(selector);
    parts = {
      strip: q('.strip'), who: q('.strip .who'), subtitle: q('.strip .subtitle'), sides: q('.strip .sides'),
      step: q('.strip .step'), caption: q('.strip .caption'),
      card: q('.card'), sheet: q('.card .sheet'), logo: q('.card .logo'), cardSubtitle: q('.card .subtitle'),
      cardTitle: q('.card .title'), cardPeople: q('.card .people'), cardSides: q('.card .sides'),
      cardNotes: q('.card .notes'), cardWho: q('.card .who'), pointer: q('.pointer'), ring: q('.ring'),
    };
    if (LOOK.logo) { parts.logo.src = LOOK.logo; parts.logo.hidden = false; }
    redraw();
    return parts;
  };
  const read = (key) => { try { return sessionStorage.getItem(key) || ''; } catch (e) { return ''; } };
  const readList = (key) => { try { const kept = JSON.parse(read(key)); return Array.isArray(kept) ? kept : []; } catch (e) { return []; } };
  const shown = { step: read(KEYS.step), caption: read(KEYS.caption), who: read(KEYS.who), subtitle: read(KEYS.subtitle), sides: readList(KEYS.sides) };
  // A page without storage (a sandboxed frame) still shows everything now; only a reload loses it.
  const keep = (key, value) => { try { sessionStorage.setItem(key, value); } catch (e) { /* shown, not kept */ } };
  const write = (name, value) => { shown[name] = value; keep(KEYS[name], value); };
  const writeList = (values) => { shown.sides = Array.isArray(values) ? values : []; keep(KEYS.sides, JSON.stringify(shown.sides)); };
  const escaped = (text) => String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = (into, values) => { into.innerHTML = (values || []).map((value) => '<span>' + escaped(value) + '</span>').join(''); };
  const redraw = () => {
    if (!parts) return;
    parts.who.textContent = shown.who;
    parts.subtitle.textContent = shown.subtitle;
    parts.step.textContent = shown.step;
    parts.caption.textContent = shown.caption;
    lines(parts.sides, shown.sides);
    parts.strip.hidden = !shown.step && !shown.caption && !shown.who && !shown.subtitle && !shown.sides.length;
  };

  // The card's own clock, read back by the self-check: the hold is measured, not assumed.
  const cardClock = { shownAtMs: 0, hiddenAtMs: 0 };
  // A heading can be a full sentence. At 54px one of those runs off the frame, so the sheet is
  // measured and the heading stepped down until the whole card stands inside the frame.
  const fitTheCard = (p) => {
    let size = 54;
    p.cardTitle.style.fontSize = size + 'px';
    const tooTall = () => p.sheet.getBoundingClientRect().height > window.innerHeight * 0.9;
    while (size > 22 && tooTall()) { size -= 3; p.cardTitle.style.fontSize = size + 'px'; }
    return size;
  };

  // --- masking: painted over, never changed -------------------------------------------------
  const PATTERNS = { email: /[^\s@<>()]+@[^\s@<>()]+\.[A-Za-z]{2,}/g, phone: /\+?\d[\d\s().-]{7,}\d/g };
  const startMasking = () => {
    const wanted = LOOK.masking.patterns.map((name) => PATTERNS[name]);
    if (!LOOK.masking.fields.length && !wanted.length) return;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(SETTINGS.maskStyle);
    document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
    if (!wanted.length) return;
    // Thrown, not skipped: a page error is how the scenario hears that masking cannot work here.
    if (!window.CSS || !CSS.highlights || typeof Highlight !== 'function') throw new Error('scenario-video: masking needs the CSS highlight registry (Chromium 105+), and this browser has none');
    const highlight = new Highlight();
    CSS.highlights.set('scenario-video-mask', highlight);
    let queued = false;
    const scan = () => {
      queued = false;
      highlight.clear();
      if (!document.body) return;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.nodeValue || '';
        for (const pattern of wanted) {
          pattern.lastIndex = 0;
          for (let found = pattern.exec(text); found; found = pattern.exec(text)) {
            const range = new Range();
            range.setStart(node, found.index);
            range.setEnd(node, found.index + found[0].length);
            highlight.add(range);
          }
        }
      }
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(scan); } };
    new MutationObserver(queue).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    scan();
  };

  window[SETTINGS.global] = {
    who(name) { write('who', name); build(); redraw(); },
    step(title, subtitle, sides) { write('step', title); write('caption', ''); write('subtitle', subtitle || ''); writeList(sides); build(); redraw(); },
    caption(text) { write('caption', text); build(); redraw(); },
    // true raises the card; false lets it fade out WITH ITS WORDS STILL ON IT — blanking them at
    // the same moment would fade out an empty panel. The next card replaces them.
    card(slide, on) {
      const p = build(); if (!p) return;
      if (on) {
        const it = slide || {};
        p.cardSubtitle.textContent = it.subtitle || '';
        p.cardTitle.textContent = it.title || '';
        p.cardPeople.textContent = (it.people || []).length ? LOOK.peopleLabel + it.people.join(' · ') : '';
        lines(p.cardSides, it.sideNotes);
        lines(p.cardNotes, it.slideNotes);
        p.cardWho.textContent = it.who || '';
        fitTheCard(p);
        cardClock.shownAtMs = Date.now();
      } else {
        cardClock.hiddenAtMs = Date.now();
      }
      p.card.classList.toggle('on', !!on);
    },
    point(x, y, width, height) {
      const p = build(); if (!p) return;
      p.pointer.hidden = false; p.ring.hidden = false;
      p.pointer.style.left = (x + width / 2) + 'px'; p.pointer.style.top = (y + height / 2) + 'px';
      p.ring.style.left = (x - 4) + 'px'; p.ring.style.top = (y - 4) + 'px';
      p.ring.style.width = (width + 8) + 'px'; p.ring.style.height = (height + 8) + 'px';
    },
    // Numbers only, for the self-check — the one way into a closed shadow root. It adds nothing.
    probe() {
      const p = build(); if (!p) return null;
      const box = p.sheet.getBoundingClientRect();
      const title = getComputedStyle(p.cardTitle);
      return {
        cardOpacity: Number(getComputedStyle(p.card).opacity),
        cardTransition: getComputedStyle(p.card).transitionDuration,
        cardDirection: getComputedStyle(p.card).direction,
        stripDirection: getComputedStyle(p.strip).direction,
        titleFontSizePx: parseFloat(title.fontSize),
        titleLines: Math.round(p.cardTitle.getBoundingClientRect().height / (parseFloat(title.lineHeight) || 1)),
        cardFitsTheFrame: box.top >= 0 && box.left >= 0 && box.bottom <= window.innerHeight + 1 && box.right <= window.innerWidth + 1,
        cardHeldMs: cardClock.hiddenAtMs && cardClock.shownAtMs ? cardClock.hiddenAtMs - cardClock.shownAtMs : 0,
        cardText: (p.sheet.textContent || '').replace(/\s+/g, ' ').trim(),
        stripSidesHtml: p.sides.innerHTML,
        stripLinesCut: Array.prototype.slice.call(p.strip.querySelectorAll('.sides span')).filter((line) => line.scrollWidth > line.clientWidth + 1).length,
        pointerX: parseFloat(p.pointer.style.left) || 0,
        pointerY: parseFloat(p.pointer.style.top) || 0,
        maskedRanges: window.CSS && CSS.highlights && CSS.highlights.get('scenario-video-mask') ? CSS.highlights.get('scenario-video-mask').size : 0,
      };
    },
  };
  const start = () => { build(); startMasking(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
`;
}
