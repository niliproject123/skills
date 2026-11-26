// screen-fit - grades a REAL running page on layout geometry, deterministically.
//
// Point it at a dev server and it opens every route at every viewport, measures
// every element with getBoundingClientRect, and grades the geometry in Node.
// No screenshots to squint at: five checks, a PASS/FAIL per criterion, and one
// detail line per hit naming the element and how many pixels are wrong.
//
//   1. nothing crosses nothing - no element over a viewport edge, no overlap
//      between two elements in normal flow, no content spilling past the card
//      that holds it, no interactive element clipped away by a container that
//      hides its overflow
//   2. empty space             - target 15% of the screen, pass band 10-15%
//   3. non-navbar buttons      - hold their share of the viewport, so they do
//                                not look small on a big screen
//
// Criterion 1 is the hard gate. 2 and 3 are tuned without regressing 1.
//
// COPIED from c:/dev/backgammon/main/tests (probe + tests/specific analyzers),
// where it was written against that app. Everything app-specific here is now an
// env var with a harmless default - the opaque list, the localStorage seeding,
// the routes, the output folder. The analyzers beside this file are unchanged.
// Read README.md before pointing it at a new app; the opaque list in particular
// has to be set or a drawing surface reports every shape as an overlap.
//
// MOCKED DATA: none of the geometry. Every rect is measured from a real page in
// a real browser.
//
// usage: WEB_URL=http://localhost:5173 npx tsx screen-fit.ts
//        ROUTES=/,/lobby VIEWPORTS=laptop,big npx tsx screen-fit.ts
//        OUT_DIR=discussions/<folder>/reports/screen-fit npx tsx screen-fit.ts
//
// Reports and screenshots default to ./screen-fit-report beside this file;
// OUT_DIR (relative to the cwd) sends them to a discussion folder instead.
import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detectViolations, analyzeEmptiness, detectSmall, detectSpill, detectClipped, analyzeHoles,
  type RectMap, type MetaMap,
} from './screen-fit-analyzers.js';
import { drawMarks, clearMarks, blurText, buildMarks, emptyNote } from './screen-fit-marks.js';

const WEB_URL = process.env['WEB_URL'] ?? 'http://localhost:5173';
// Output lands next to this script, so the probe does not depend on the cwd it
// was launched from and does not resurrect a discussion folder from the branch
// it was written on. Point OUT_DIR at a discussion folder to follow the usual
// reports convention: OUT_DIR=discussions/<folder>/reports/screen-fit
const here = dirname(fileURLToPath(import.meta.url));
const OUT = process.env['OUT_DIR']
  ? resolve(process.cwd(), process.env['OUT_DIR'])
  : resolve(here, 'screen-fit-report');
mkdirSync(OUT, { recursive: true });

// Criteria 2 and 3 are TASTE, and the numbers below came from a game that fills
// its screen. A diagram viewer or an editor is legitimately mostly empty, and a
// toolbar of icon buttons is legitimately small — left at these defaults such an
// app reports FAIL forever and the report stops being read. Retune per app, or
// switch either off with EMPTY_BAND=off / MIN_BUTTON_PCT=off.
//
// Criterion 1 has no knob. Geometry that collides is wrong in every app.
const EMPTY_BAND: [number, number] | null =
  (process.env['EMPTY_BAND'] ?? '10-15').toLowerCase() === 'off'
    ? null
    : ((process.env['EMPTY_BAND'] ?? '10-15').split('-').map(Number) as [number, number]);
const EMPTY_TARGET = EMPTY_BAND ? EMPTY_BAND[1] : 0;
// HOLE_MIN_SIDE: below 80px (two table rows) a gap is spacing, not a hole.
// FULL_PAGE grades the whole document, not the first screenful; `edge` then means the document's
// edge. Criterion 3 stays on the real viewport either way. See README "The fold".
// MARK=true draws every hit on the screenshot; BLUR_TEXT=true makes its text unreadable (after
// measuring); INJECT_CSS=<file> adds a stylesheet after each route loads and BEFORE it is graded.
const MARK = (process.env['MARK'] ?? 'false').toLowerCase() === 'true';
const BLUR_TEXT = (process.env['BLUR_TEXT'] ?? 'false').toLowerCase() === 'true';
const INJECT_CSS = process.env['INJECT_CSS'] ? resolve(process.cwd(), process.env['INJECT_CSS']) : '';
const FULL_PAGE = (process.env['FULL_PAGE'] ?? 'false').toLowerCase() === 'true';
const HOLE_MIN_SIDE =
  (process.env['HOLE_MIN_SIDE'] ?? '80').toLowerCase() === 'off' ? 0 : Number(process.env['HOLE_MIN_SIDE'] ?? 80);
const MIN_BUTTON_SIDE_PCT =
  (process.env['MIN_BUTTON_PCT'] ?? '10').toLowerCase() === 'off'
    ? 0
    : Number(process.env['MIN_BUTTON_PCT'] ?? 10);

// The landscape set came from an app that is landscape-only; the portrait ones
// are added here because most apps are not. Pick per run with VIEWPORTS=…, and
// note the default set is DESKTOP ONLY — ask for the phone sizes explicitly, or
// a mobile bug will simply not be looked for.
const VIEWPORTS = {
  phone: { width: 390, height: 844, deviceScaleFactor: 3 },       // iPhone portrait
  phoneWide: { width: 749, height: 346, deviceScaleFactor: 3.12 }, // phone landscape
  compact: { width: 667, height: 360, deviceScaleFactor: 2 },     // small phone landscape
  tabletUp: { width: 768, height: 1024, deviceScaleFactor: 2 },   // iPad portrait
  tablet: { width: 1024, height: 768, deviceScaleFactor: 2 },     // 4:3 — tall vh fonts vs narrow cards
  ipad: { width: 1180, height: 820, deviceScaleFactor: 2 },       // iPad Air landscape
  laptop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  big: { width: 1920, height: 1080, deviceScaleFactor: 1 },
} as const;

const ROUTES = (process.env['ROUTES'] ?? '/').split(',');

// Units NOT descended into: their insides are a drawing surface, not page
// layout. A chart, a game board or an icon overlaps itself by design and would
// bury criterion 1 in false positives. Add app selectors with OPAQUE - e.g.
// OPAQUE='.diagram-surface svg,[data-testid="board"]'.
const OPAQUE_SELECTORS = (process.env['OPAQUE'] ?? 'svg,canvas')
  .split(',').map((entry) => entry.trim()).filter(Boolean);

// Anything the page needs in localStorage before it will render - a stub auth
// token, a "seen the welcome dialog" flag. JSON object, applied at the origin
// before the first route: SEED_STORAGE='{"auth_token":"stub"}'. Left empty the
// probe touches nothing.
const SEED_STORAGE: Record<string, string> = JSON.parse(process.env['SEED_STORAGE'] ?? '{}');

// Same, into sessionStorage. An app that keeps its session there on purpose — so it dies with the
// tab — cannot be seeded through localStorage at all.
const SEED_SESSION: Record<string, string> = JSON.parse(process.env['SEED_SESSION_STORAGE'] ?? '{}');

// Selectors clicked after a route has loaded and before it is graded, in order. This is the
// app-neutral half of "reaching screens that have no URL": a tab, a panel, a step of a flow that
// plain navigation never lands on. Unset, nothing is clicked and the run is exactly as before.
const AFTER_LOAD_CLICKS = (process.env['AFTER_LOAD_CLICKS'] ?? '').split(',').map((one) => one.trim()).filter(Boolean);
const PICKED = (process.env['VIEWPORTS'] ?? 'tablet,laptop,big').split(',');

const t0 = Date.now();
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;

// ── DOM extraction ──────────────────────────────────────────────────────────
// Runs in the browser. ONLY anonymous inline arrows here — naming an inner
// function emits esbuild's __name() wrapper, which throws in the page.
interface RawRect { left: number; top: number; right: number; bottom: number }
async function extract(page: Page, fullPage: boolean): Promise<{
  rects: RectMap; meta: MetaMap; skipped: string[];
  ancestors: Record<string, string[]>; positioned: Record<string, boolean>;
  raws: Record<string, RawRect>; clips: Record<string, boolean>;
  hiddenVis: Record<string, RawRect>; clipper: Record<string, string>;
  canvasW: number; canvasH: number;
  scrolls: Record<string, { x: number; y: number }>;
}> {
  return page.evaluate(([OPAQUE, whole]: [string[], boolean]) => {
    const vw = window.innerWidth;
    // The bound elements are kept against. On a whole-page run this is the document's height, so
    // nothing below the fold is discarded as offscreen.
    const vh = whole
      ? Math.max(document.documentElement.scrollHeight, window.innerHeight)
      : window.innerHeight;

    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    const metaOut: Record<string, { container: boolean; hasText: boolean; interactive: boolean }> = {};
    const skipped: string[] = [];
    // An element whose own content does not fit inside it, so it carries a scrollbar. Nothing in
    // this probe used to read scrollWidth/scrollHeight at all, which is why a form card scrolling
    // 25px sideways at every viewport was never once reported: `clip` deliberately exempts
    // scrollable ancestors, and a ratio of empty space cannot see a scrollbar.
    const scrolls: Record<string, { x: number; y: number }> = {};
    const positioned: Record<string, boolean> = {};
    // raws = the element's UNCLIPPED box (what actually paints, spill included).
    // clips = true if this element hides its own overflow (so a child can't
    // visibly spill past it). Together they catch content crossing a card edge —
    // the class of bug the viewport-edge + nesting-exempt checks miss.
    const raws: Record<string, RawRect> = {};
    const clips: Record<string, boolean> = {};
    // hiddenVis = the box clipped to ONLY overflow:hidden/clip ancestors (never
    // auto/scroll — scroll-clipped content is reachable). clipper = a label for
    // the nearest such ancestor. detectClipped compares raws vs hiddenVis to
    // flag a control cut off by a container it can never be scrolled out of.
    const hiddenVis: Record<string, RawRect> = {};
    const clipper: Record<string, string> = {};
    const kept: { el: Element; id: string }[] = [];

    const all = Array.from(document.body.querySelectorAll('*'));
    for (const el of all) {
      // inside an opaque unit (but not the unit itself)? skip entirely
      let insideOpaque = false;
      for (const sel of OPAQUE) {
        const anc = el.closest(sel);
        if (anc && anc !== el) { insideOpaque = true; break; }
      }
      if (insideOpaque) continue;

      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'br' || tag === 'defs') continue;

      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
      // Inside a closed <details> an element keeps a layout box but is painted nowhere (the browser
      // skips its contents), so its rect is real and measuring it invents collisions — 442 of them
      // on one file tree whose folders were closed. `checkVisibility` knows; the style checks above do not.
      if (typeof (el as HTMLElement).checkVisibility === 'function' && !(el as HTMLElement).checkVisibility()) continue;
      // Decorative overlays (absolutely-positioned, click-through) are painted
      // ON TOP of their siblings on purpose — bevel/glow SVGs over a button
      // label. They are layering, not collisions, and they are not layout.
      if (cs.pointerEvents === 'none' && (cs.position === 'absolute' || cs.position === 'fixed')) continue;

      const raw = el.getBoundingClientRect();
      if (raw.width < 1 || raw.height < 1) continue;

      // An ancestor with overflow!=visible CLIPS this element. A collapsed
      // picker (max-height:0 + overflow:hidden) leaves its children with full
      // rects that are painted nowhere — measuring those invents collisions
      // against whatever is drawn in that space. Clip to every such ancestor
      // and use the visible remainder as the element's real geometry.
      let x1 = raw.left, y1 = raw.top, x2 = raw.right, y2 = raw.bottom;
      // hidden-only box: clip to overflow:hidden|clip ancestors ONLY. A control
      // cut off by one of these can never be scrolled into view = a bug. Scroll
      // (auto/scroll) ancestors are excluded — their overflow is reachable.
      let hx1 = raw.left, hy1 = raw.top, hx2 = raw.right, hy2 = raw.bottom;
      let clipperLabel = '';
      let p = el.parentElement;
      while (p && p !== document.body) {
        const ps = getComputedStyle(p);
        if (ps.overflow !== 'visible' || ps.overflowX !== 'visible' || ps.overflowY !== 'visible') {
          const pr = p.getBoundingClientRect();
          x1 = Math.max(x1, pr.left); y1 = Math.max(y1, pr.top);
          x2 = Math.min(x2, pr.right); y2 = Math.min(y2, pr.bottom);
          const oy = ps.overflowY, ox = ps.overflowX, o = ps.overflow;
          const hides = (v: string) => v === 'hidden' || v === 'clip';
          if (hides(o) || hides(oy) || hides(ox)) {
            const before = hy2 - hy1 + (hx2 - hx1);
            hx1 = Math.max(hx1, pr.left); hy1 = Math.max(hy1, pr.top);
            hx2 = Math.min(hx2, pr.right); hy2 = Math.min(hy2, pr.bottom);
            if (!clipperLabel && (hy2 - hy1 + (hx2 - hx1)) < before) {
              const tid = p.getAttribute('data-testid');
              clipperLabel = tid ? `#${tid}` : (p.getAttribute('class') ?? p.tagName).slice(0, 40);
            }
          }
        }
        p = p.parentElement;
      }
      const r = { left: x1, top: y1, right: x2, bottom: y2, width: x2 - x1, height: y2 - y1 };
      if (r.width < 1 || r.height < 1) continue;              // fully clipped away
      if (r.width * r.height < 150) continue;                 // sandbox sliver floor
      if (r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) continue; // offscreen

      // Criterion 3 is about BUTTONS, and explicitly "non-navbar". So:
      //  - real controls only (cursor:pointer is set on far too much to mean
      //    "button" — it flagged every span and icon),
      //  - outermost only (the <span> and <img> inside an <a> are not buttons),
      //  - nothing inside the nav/tab bar.
      const isControl =
        tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' ||
        el.getAttribute('role') === 'button';
      const inNav = !!el.closest('nav, [role="navigation"], [data-testid*="tabbar"], [data-testid*="navbar"]');
      const nestedInControl = !!el.parentElement?.closest('button, a, [role="button"]');
      const interactive = isControl && !inNav && !nestedInControl;

      // direct text only — a wrapper whose text lives in children isn't a text node
      let ownText = '';
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType === 3) ownText += n.textContent ?? '';
      }
      const hasText = ownText.trim().length > 0;

      const media = tag === 'img' || tag === 'svg' || tag === 'canvas' || tag === 'video';
      const painted =
        (cs.backgroundImage && cs.backgroundImage !== 'none') ||
        (cs.backgroundColor && !/rgba?\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) ||
        (cs.borderStyle && cs.borderStyle !== 'none' && parseFloat(cs.borderWidth || '0') > 0);

      // An opaque unit is kept unconditionally: the board carries no paint of
      // its own (the wood is a child image) and would otherwise be dropped by
      // the meaningfulness filter below — which put /play at 90% "empty" while
      // the board visibly covered three quarters of the screen.
      const isOpaqueUnit = OPAQUE.some((sel) => el.matches(sel));

      // Visually meaningful only. Layout-only wrappers with no paint and no
      // content of their own are not "elements" a designer would place.
      if (!isOpaqueUnit && !(interactive || hasText || media || painted)) continue;

      const testid = el.getAttribute('data-testid');
      const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      const base = testid ? `#${testid}` : cls ? `${tag}.${cls}` : tag;
      let id = base;
      let n = 2;
      while (id in out) { id = `${base}~${n++}`; }

      // Sandbox split: card/div (painted only) are containers and count AS empty
      // space; graph/img/button/text carry information and FILL it. Derived
      // here rather than hardcoded: if the only reason we kept this node is
      // that it paints a background/border, it is a background. A button is
      // content even though it also paints.
      // An opaque unit (the board) is the page's primary CONTENT, not a
      // background — we simply decline to descend into it.
      const container = !(hasText || media || interactive || isOpaqueUnit);

      out[id] = { x: r.left, y: r.top, w: r.width, h: r.height };
      // Only an axis that really scrolls. `overflow: hidden` also reports scrollWidth past
      // clientWidth — that is a `.cut` cell truncating with an ellipsis and keeping its whole
      // value in the title, which is deliberate and would drown the real hits; content lost
      // that way is what `clip` is for.
      const scrollableX = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
      const scrollableY = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
      const overX = scrollableX ? el.scrollWidth - el.clientWidth : 0;
      const overY = scrollableY ? el.scrollHeight - el.clientHeight : 0;
      if (el.clientWidth > 0 && el.clientHeight > 0 && (overX > 4 || overY > 4)) {
        scrolls[id] = { x: overX > 4 ? overX : 0, y: overY > 4 ? overY : 0 };
      }
      metaOut[id] = { container, hasText, interactive };
      // Absolute/fixed placement is an explicit "draw this on top" instruction
      // (flag badge on an avatar corner, ribbon on a card). Normal-flow
      // elements overlapping is a layout bug. The probe grades those two
      // differently instead of guessing intent.
      // `sticky` belongs here with `absolute` and `fixed`. A stuck bar keeps its slot in the
      // flow, so a position test that omits it calls a designed bottom bar a collision with
      // every row it is pinned over — seventeen of them on one admin screen — and the real
      // hits drown. Whether an overlay is wanted is still a human's call: these are listed
      // under `overlay?` and gate nothing.
      positioned[id] = cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky';
      raws[id] = { left: raw.left, top: raw.top, right: raw.right, bottom: raw.bottom };
      clips[id] = cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
      hiddenVis[id] = { left: hx1, top: hy1, right: hx2, bottom: hy2 };
      if (clipperLabel) clipper[id] = clipperLabel;
      kept.push({ el, id });
    }

    // real DOM ancestry between kept nodes — feeds the layering exemption
    const ancestors: Record<string, string[]> = {};
    for (const a of kept) {
      ancestors[a.id] = [];
      for (const b of kept) {
        if (a === b) continue;
        if (b.el.contains(a.el)) ancestors[a.id]!.push(b.id);
      }
    }
    return {
      rects: out, meta: metaOut, skipped, ancestors, positioned, raws, clips, hiddenVis, clipper,
      canvasW: vw, canvasH: vh, scrolls,
    };
  }, [OPAQUE_SELECTORS, fullPage] as [string[], boolean]);
}

// ── navigation ──────────────────────────────────────────────────────────────
async function gotoRoute(page: Page, route: string): Promise<boolean> {
  await page.goto(`${WEB_URL}${route}`, { waitUntil: 'domcontentloaded' });
  // Give layout + fonts + images a beat to settle; geometry read too early is
  // geometry of a half-painted page.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const body = await page.evaluate(() => document.body.innerText.trim().length);
  if (body === 0) throw new Error(`${route} rendered an empty body`);
  return true;
}

interface Row {
  viewport: string; route: string;
  edgeHits: number; overlaps: number; softOverlaps: number; spills: number; clipped: number; emptyPct: number;
  smalls: number; elements: number; biggestHole: string; scrollers: number; sideScrollers: number;
  detail: string[];
}

async function main() {
  const browser: Browser = await chromium.launch({ headless: process.env['HEADLESS'] !== 'false' });
  const rows: Row[] = [];
  const errs: string[] = [];

  try {
    for (const vpName of PICKED) {
      const vp = VIEWPORTS[vpName as keyof typeof VIEWPORTS];
      if (!vp) throw new Error(`unknown viewport "${vpName}" (have: ${Object.keys(VIEWPORTS).join(', ')})`);

      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
      });
      const page = await ctx.newPage();
      // Before any page script runs, not after the first load: an app that reads its session at
      // boot has already decided it is signed out by the time an `evaluate` could seed it, and a
      // goto that only changes the hash never re-runs that boot.
      if (Object.keys(SEED_SESSION).length > 0) {
        await ctx.addInitScript((seed: Record<string, string>) => {
          for (const key of Object.keys(seed)) sessionStorage.setItem(key, seed[key] as string);
        }, SEED_SESSION);
      }
      // esbuild (which tsx runs the file through) may compile a named arrow in
      // an evaluate body into `__name(fn, "fn")` to keep its name for stack
      // traces. That helper exists in the bundle, NOT in the page, so the
      // injected body dies with `ReferenceError: __name is not defined` and the
      // probe measures nothing. Defining it as identity in the page makes the
      // script safe to run from any project, whatever its build flags are.
      await page.addInitScript(() => {
        (window as unknown as { __name?: unknown }).__name ??= (fn: unknown) => fn;
      });
      page.on('pageerror', (e) => errs.push(`[${vpName}] PAGEERROR ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errs.push(`[${vpName}] CONSOLE ${m.text().slice(0, 200)}`); });
      page.on('requestfailed', (r) => errs.push(`[${vpName}] REQFAIL ${r.url()} ${r.failure()?.errorText ?? ''}`));
      page.on('response', (r) => { if (r.status() >= 400) errs.push(`[${vpName}] HTTP ${r.status()} ${r.url()}`); });

      await page.goto(WEB_URL, { waitUntil: 'domcontentloaded' });
      // Whatever this app needs before it will render a page. Nothing by
      // default; see SEED_STORAGE. Never put a real credential here — a stub
      // token against a stubbed backend is the intended use.
      if (Object.keys(SEED_STORAGE).length > 0) {
        await page.evaluate((seed: Record<string, string>) => {
          for (const key of Object.keys(seed)) localStorage.setItem(key, seed[key] as string);
        }, SEED_STORAGE);
      }

      // Grade whatever is currently on screen under `label`. Returned so the
      // caller can gate; also pushes a row, screenshots, and logs.
      const gradeCurrent = async (label: string): Promise<number> => {
        const { rects, meta, ancestors, positioned, raws, clips, hiddenVis, clipper, canvasW, canvasH, scrolls } =
          await extract(page, FULL_PAGE);
        const ids = Object.keys(rects);
        if (ids.length === 0) {
          errs.push(`[${vpName}] ${label}: extracted 0 elements — extraction filter is wrong for this page`);
          return -1;
        }

        const { edgeHits, overlaps } = detectViolations(rects, meta, canvasW, canvasH, ancestors);
        const emptiness = analyzeEmptiness(rects, meta, canvasW, canvasH);
        // A band of nothing inside the content. The page empty %% is a ratio and cannot see one:
        // a 1020x133 hole under a table and the same pixels spread thinly between its rows score
        // the same. Reported, never gated — a deliberate gap is not a bug.
        const holes = HOLE_MIN_SIDE > 0 ? analyzeHoles(rects, meta, canvasW, canvasH, HOLE_MIN_SIDE) : [];
        const smalls = MIN_BUTTON_SIDE_PCT > 0
          ? detectSmall(rects, meta, vp.width, vp.height, MIN_BUTTON_SIDE_PCT)
          : [];
        const spills = detectSpill(raws, meta, ancestors, clips, rects);
        // Cut off and UNREACHABLE. Compares each control's real box against the
        // box left after overflow:hidden/clip ancestors have had their way —
        // never auto/scroll, because content you can scroll to is not lost.
        // The original probe extracted hiddenVis/clipper for this and then
        // never called it, so nothing graded the one thing the analyzer was
        // written for.
        const clipped = detectClipped(raws, hiddenVis, meta, clipper);

        // hard = both elements in normal flow → a real layout bug.
        // soft = one is absolutely placed → a deliberate overlay; listed for
        // human review, NOT counted in the criterion-1 gate.
        // Being inside an overlay makes you part of the overlay: the flag image
        // sits statically inside an absolutely-placed badge, so it is just as
        // deliberately drawn on top as the badge itself.
        const inOverlay = (id: string): boolean =>
          !!positioned[id] || (ancestors[id] ?? []).some((a) => positioned[a]);
        const hard = overlaps.filter((o) => !inOverlay(o.a) && !inOverlay(o.b));
        const soft = overlaps.filter((o) => inOverlay(o.a) || inOverlay(o.b));

        const detail: string[] = [];
        for (const e of edgeHits) detail.push(`EDGE  ${e.id} crosses ${e.sides.join('+')}`);
        for (const o of hard) detail.push(`OVER  ${o.a} x ${o.b} — ${o.ox}x${o.oy}px`);
        for (const sp of spills) detail.push(`SPILL ${sp.child} pokes ${sp.overPx}px past ${sp.card} (${sp.sides.join('+')})`);
        for (const c of clipped) detail.push(`CLIP  ${c.id} cut off ${c.overPx}px by ${c.card} (${c.sides.join('+')})`);
        for (const s of smalls) detail.push(`SMALL ${s.id} — ${s.reasons.join('; ')}`);
        for (const h of holes) detail.push(`HOLE  ${h.w}x${h.h}px of nothing at (${h.x},${h.y}) inside ${h.inside} — review`);
        for (const id of Object.keys(scrolls)) {
          const o = scrolls[id]!;
          const axes = [o.y ? `down by ${o.y}px` : '', o.x ? `sideways by ${o.x}px` : ''].filter(Boolean).join(' and ');
          detail.push(`SCROLL ${id} does not fit itself — scrolls ${axes} — review`);
        }
        for (const o of soft) detail.push(`overlay? ${o.a} x ${o.b} — ${o.ox}x${o.oy}px (absolutely placed — review)`);

        rows.push({
          viewport: vpName, route: label,
          edgeHits: edgeHits.length, overlaps: hard.length, softOverlaps: soft.length,
          spills: spills.length, clipped: clipped.length,
          emptyPct: emptiness.page.emptyPct, smalls: smalls.length,
          biggestHole: holes.length ? `${holes[0]!.w}x${holes[0]!.h}` : '-',
          scrollers: Object.keys(scrolls).length,
          sideScrollers: Object.values(scrolls).filter((o) => o.x > 0).length,
          elements: ids.length, detail,
        });

        // Every character a file name cannot hold on Windows — a route with `?stage=design` crashed the run.
        const slug = label === '/' ? 'home' : label.replace(/[/:?*"<>|]/g, '');
        if (BLUR_TEXT) await blurText(page);
        if (MARK) await drawMarks(page, buildMarks({ rects, raws, scrolls, holes, smalls, edgeHits, hard, spills, clipped }), emptyNote(emptiness.page.emptyPct, EMPTY_BAND));
        await page.screenshot({ path: `${OUT}/${vpName}_${slug}.png`, fullPage: FULL_PAGE });
        if (MARK) await clearMarks(page);
        console.log(
          `${ts()} ${vpName.padEnd(6)} ${label.padEnd(14)} ` +
          `elements=${String(ids.length).padStart(3)} ` +
          `edge=${edgeHits.length} overlap=${hard.length} spill=${spills.length} clip=${clipped.length} overlay?=${soft.length} ` +
          `empty=${emptiness.page.emptyPct.toFixed(1)}% smallBtns=${smalls.length} `+
          `hole=${holes.length ? `${holes[0]!.w}x${holes[0]!.h}` : '-'} `+
          `scrolls=${Object.keys(scrolls).length}`,
        );
        return edgeHits.length + hard.length + spills.length + clipped.length;
      };

      for (const route of ROUTES) {
        try {
          await gotoRoute(page, route);
        } catch (e) {
          errs.push(`[${vpName}] ${route} NAV FAILED: ${String(e).slice(0, 300)}`);
          continue;
        }
        // Screens you can only reach by clicking — a tab, a modal, a second step
        // of a flow — are not reachable by URL. AFTER_LOAD_CLICKS walks to one
        // before the geometry is read; a selector that never appears is an error,
        // never a quietly ungraded route. See README.md.
        let reached = true;
        for (const selector of AFTER_LOAD_CLICKS) {
          try {
            const target = page.locator(selector).first();
            await target.waitFor({ state: 'visible', timeout: 10_000 });
            await target.click();
            await page.waitForTimeout(600);
          } catch (e) {
            errs.push(`[${vpName}] ${route} AFTER_LOAD_CLICKS "${selector}" never became clickable: ${String(e).slice(0, 200)}`);
            reached = false;
            break;
          }
        }
        if (!reached) continue;
        if (INJECT_CSS) { await page.addStyleTag({ path: INJECT_CSS }); await page.waitForTimeout(400); }
        await gradeCurrent(route);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  // ── report ────────────────────────────────────────────────────────────────
  const lines: string[] = [];
  lines.push('# screen-fit — real-DOM layout grading');
  lines.push('');
  lines.push(`Web: ${WEB_URL}. Mocked: none of the geometry.`);
  lines.push(`Criteria: (1) zero collisions [hard, always on]`);
  lines.push(EMPTY_BAND
    ? `(2) empty ${EMPTY_BAND[0]}-${EMPTY_BAND[1]}% target ${EMPTY_TARGET}%`
    : '(2) empty space — off for this run (EMPTY_BAND=off)');
  lines.push(MIN_BUTTON_SIDE_PCT > 0
    ? `(3) button min side >= ${MIN_BUTTON_SIDE_PCT}% of viewport short side.`
    : '(3) button size — off for this run (MIN_BUTTON_PCT=off)');
  lines.push('');
  lines.push('Overlaps are split: `overlap` = both elements in normal flow (a real bug,');
  lines.push('gates criterion 1). `overlay?` = one is absolutely placed, i.e. deliberately');
  lines.push('drawn on top (badge on an avatar). Those are listed for review, not gated —');
  lines.push('no automated check can tell a designed overlay from a mistake.');
  lines.push('');
  lines.push('`spill` = content whose real box pokes out past the button/card that');
  lines.push('holds it (coin wider than its tile, image past a card edge).');
  lines.push('');
  lines.push('`clip` = an interactive element cut off by a container that HIDES its');
  lines.push('overflow, so it cannot be scrolled into view — it is simply gone. Scroll');
  lines.push('containers are exempt: content you can reach is not lost.');
  lines.push('');
  lines.push('All four gate criterion 1 — they are what "nothing crosses nothing" means.');
  lines.push('');
  lines.push('`HOLE` = the largest rectangle of nothing INSIDE the content, with both sides at');
  lines.push('least HOLE_MIN_SIDE px. The empty % cannot see one: it is a ratio, so a band of');
  lines.push('nothing under a table and the same pixels spread thinly between its rows score the');
  lines.push('same. Reported for review, never gated — a deliberate gap is not a bug. Page');
  lines.push('margins are excluded: holes are measured inside the content own bounding box.');
  lines.push('');
  lines.push('`SCROLL` = an element whose own content does not fit inside it, so it carries a');
  lines.push('scrollbar. Only axes whose overflow is auto/scroll count: overflow:hidden also');
  lines.push('reports content past the box, but that is a cell truncating with an ellipsis and');
  lines.push('keeping its value in the title. Reported for review, never gated — a list column');
  lines.push('that scrolls is the design; a form card that scrolls usually is not.');
  lines.push('');
  lines.push('| viewport | route | elements | edge | overlap | spill | clip | overlay? | empty % | biggest hole | scrolls (x) | small btns | c1 | c2 | c3 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const c1 = r.edgeHits + r.overlaps + r.spills + r.clipped === 0 ? 'PASS' : 'FAIL';
    const c2 = !EMPTY_BAND ? 'off' : r.emptyPct >= EMPTY_BAND[0] && r.emptyPct <= EMPTY_BAND[1] ? 'PASS' : 'FAIL';
    const c3 = MIN_BUTTON_SIDE_PCT === 0 ? 'off' : r.smalls === 0 ? 'PASS' : 'FAIL';
    lines.push(
      `| ${r.viewport} | ${r.route} | ${r.elements} | ${r.edgeHits} | ${r.overlaps} | ${r.spills} | ${r.clipped} | ${r.softOverlaps} | ` +
      `${r.emptyPct.toFixed(1)} | ${r.biggestHole} | ${r.scrollers} (${r.sideScrollers}) | ${r.smalls} | ${c1} | ${c2} | ${c3} |`,
    );
  }
  lines.push('');
  for (const r of rows) {
    if (!r.detail.length) continue;
    lines.push(`## ${r.viewport} ${r.route}`);
    for (const d of r.detail) lines.push(`- ${d}`);
    lines.push('');
  }
  if (errs.length) {
    lines.push('## browser errors (NOT ignorable — every one is reported)');
    for (const e of [...new Set(errs)]) lines.push(`- ${e}`);
  }
  const md = lines.join('\n');
  writeFileSync(`${OUT}/screen-fit.md`, md);
  console.log(`\n${md}`);
  console.log(`\nreport: ${OUT}/screen-fit.md`);

  if (errs.length) console.log(`\n!! ${errs.length} browser error(s) — see report, do not dismiss.`);

  // A probe that measured nothing must NEVER report PASS. Every route asked for
  // has to have produced a row, or the run is void.
  const expected = PICKED.length * ROUTES.length;
  if (rows.length !== expected) {
    console.log(`\n>>> VOID: measured ${rows.length} of ${expected} viewport/route combos. ` +
      `Nothing was graded for the rest — fix the run before reading any verdict.`);
    process.exit(2);
  }

  // Must count the SAME four things the table's c1 column does. It counted
  // three — clipped was missing — so the run above printed "CRITERION 1 PASS"
  // under a table with two FAIL rows in it. A verdict that contradicts its own
  // evidence is worse than no verdict.
  const c1Fail = rows.filter((r) => r.edgeHits + r.overlaps + r.spills + r.clipped > 0);
  console.log(c1Fail.length === 0
    ? `\n>>> CRITERION 1 PASS: nothing crosses nothing (${rows.length} combos graded).`
    : `\n>>> CRITERION 1 FAIL on ${c1Fail.length} of ${rows.length} viewport/route combo(s).`);
  process.exit(c1Fail.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
