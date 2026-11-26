// modal-fit - does every overlay FIT, at every size you claim to support?
//
// An overlay is the easiest thing in an app to get wrong and the hardest to
// notice: it looks fine on the machine it was built on, and on a short screen
// its buttons are below the fold. This opens each one and measures four things
// that all mean "the user cannot see part of this":
//
//   overlayScrolls    the backdrop itself scrolls - the card is taller than the screen
//   cardTop < 0       the top of the card is above the viewport
//   cardBottom > vh   the bottom is below it
//   cardInnerOverflow something INSIDE the card is clipped or scrolled away
//
// The last one is the sneaky one. A card that fits perfectly can still have an
// overflow:hidden list inside it with half its rows cut off, and every
// screenshot looks fine. Only scroll/clip containers are measured - elements
// with the default `visible` overflow push their parent instead of clipping, so
// counting them just produces sub-pixel text-rounding noise.
//
// COPIED from c:/dev/backgammon (tests/canonical/probes/modal-fit-audit.ts), where
// the case list was a hardcoded array of that app's modals. Here the cases come
// from a JSON file, and a case can be reached by CLICKING as well as by URL -
// most apps have no debug route that renders every overlay on demand.
//
// MOCKED DATA: none. Real browser, real overlays, measured geometry.
//
// usage: WEB_URL=http://localhost:5173 CASES=./cases.json npx tsx modal-fit.ts
//
// cases.json is an array of:
//   {
//     "id":      "node-details",              // names the screenshot
//     "path":    "/web/index.html",           // appended to WEB_URL
//     "click":   ["g.node", "button.details"],// optional, clicked in order
//     "waitFor": ".diagram-details-card",     // optional, defaults to `overlay`
//     "overlay": ".diagram-details-card",     // required - the thing to measure
//     "card":    ".details-body"              // optional, defaults to overlay's first child
//   }
import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173';
// Beside this script by default, so a run does not depend on the cwd. OUT_DIR
// (cwd-relative) sends the screenshots to a discussion folder instead.
const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.OUT_DIR ? resolve(process.cwd(), process.env.OUT_DIR) : join(here, 'modal-fit-report');

interface ModalCase {
  id: string;
  /** Path appended to WEB_URL. A debug gallery that renders one overlay per
   *  query string is the cheapest way to audit them; where there is none, use
   *  `click` to drive the app into the state instead. */
  path?: string;
  /** Selectors clicked in order after the page loads, to open the overlay. */
  click?: string[];
  /** Waited for before measuring. Defaults to `overlay`. */
  waitFor?: string;
  overlay: string;
  card?: string;
}

const CASES_FILE = process.env.CASES ?? './cases.json';

function loadCases(): ModalCase[] {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), CASES_FILE), 'utf8');
  } catch (error) {
    // Never an empty run that reports "0 problems". A missing case list is a
    // setup mistake, and it must look like one.
    throw new Error(
      `cannot read the case list at ${CASES_FILE}: ${String(error)}
` +
      `Point CASES at a JSON array of overlays to audit — see the header of this file.`,
    );
  }
  const cases = JSON.parse(raw) as ModalCase[];
  if (!Array.isArray(cases) || cases.length === 0) throw new Error(`${CASES_FILE} holds no cases`);
  for (const one of cases) {
    if (!one.id || !one.overlay) throw new Error(`every case needs an "id" and an "overlay": ${JSON.stringify(one)}`);
    if (!one.path && !one.click?.length) throw new Error(`case "${one.id}" has neither a "path" nor a "click" — nothing would open it`);
  }
  return cases;
}

const MODALS: ModalCase[] = loadCases();

// The small sizes are the point — an overlay that fits at 1440x900 tells you
// nothing. Override with VIEWPORTS='360x640,1024x768'.
const VIEWPORTS = (process.env.VIEWPORTS ?? '320x568,360x640,568x320,667x375,932x430')
  .split(',')
  .map((entry) => {
    const [w, h] = entry.trim().split('x').map(Number);
    if (!w || !h) throw new Error(`bad viewport "${entry}" — want WIDTHxHEIGHT, e.g. 360x640`);
    return { name: `${w}x${h}`, w, h };
  });

interface Measurement {
  found: boolean;
  /** The measured element fills the screen and has children — almost certainly
   *  a backdrop, so `card` needs to name the dialog inside it. */
  looksLikeBackdrop: boolean;
  viewportH: number;
  overlayScrolls: boolean;
  cardTop: number;
  cardBottom: number;
  cardHeight: number;
  /** card.scrollHeight - card.clientHeight: >0 means content clipped/scrolled
   *  INSIDE the card (catches overflow-hidden silent clipping). */
  cardInnerOverflow: number;
  fits: boolean;
}

async function measure(page: Page, overlaySel: string, cardSel?: string): Promise<Measurement> {
  return page.evaluate(
    ({ overlaySel, cardSel }) => {
      const overlay = document.querySelector(overlaySel) as HTMLElement | null;
      if (!overlay) {
        return { found: false, looksLikeBackdrop: false, viewportH: window.innerHeight, overlayScrolls: false, cardTop: 0, cardBottom: 0, cardHeight: 0, cardInnerOverflow: 0, fits: false };
      }
      // Default: measure the element you NAMED. The original defaulted to
      // `overlay.firstElementChild`, which assumes the overlay is a backdrop
      // wrapping one dialog — true in the app it came from, false in general.
      // Pointed at a card whose first child is its close button, it measured a
      // 22px button, found it fits, and reported OK for every case. A default
      // that can silently measure the wrong element is worse than one that
      // makes you say which.
      const card = (cardSel ? document.querySelector(cardSel) : overlay) as HTMLElement | null;
      const vh = window.innerHeight;
      const overlayScrolls = overlay.scrollHeight > overlay.clientHeight + 1;
      const rect = card ? card.getBoundingClientRect() : { top: 0, bottom: 0, height: 0 };
      // Inner clip: only real scroll/clip containers matter. An element with
      // overflow-y auto/scroll/hidden whose scrollHeight exceeds its clientHeight
      // is silently clipping or scrolling its content. Elements with the default
      // `visible` overflow push their parent instead of clipping, so scanning
      // them just produces sub-pixel text-rounding noise — skip them.
      let cardInnerOverflow = 0;
      if (card) {
        const candidates = [card, ...Array.from(card.querySelectorAll<HTMLElement>('*'))];
        for (const el of candidates) {
          const oy = getComputedStyle(el).overflowY;
          if (oy !== 'auto' && oy !== 'scroll' && oy !== 'hidden') continue;
          const ov = el.scrollHeight - el.clientHeight;
          if (ov > cardInnerOverflow) cardInnerOverflow = ov;
        }
      }
      const overflowsTop = rect.top < -1;
      const overflowsBottom = rect.bottom > vh + 1;
      const fits = !overlayScrolls && !overflowsTop && !overflowsBottom && cardInnerOverflow <= 2;
      // A full-screen element always "fits", so a backdrop measured by mistake
      // is a guaranteed pass — the one result that must never be silent.
      const vw = window.innerWidth;
      const looksLikeBackdrop =
        !!card && card.children.length > 0 &&
        (card as HTMLElement).getBoundingClientRect().width >= vw * 0.95 &&
        rect.height >= vh * 0.95;
      return {
        found: true,
        looksLikeBackdrop,
        viewportH: vh,
        overlayScrolls,
        cardTop: Math.round(rect.top),
        cardBottom: Math.round(rect.bottom),
        cardHeight: Math.round(rect.height),
        cardInnerOverflow: Math.round(cardInnerOverflow),
        fits,
      };
    },
    { overlaySel, cardSel },
  );
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser: Browser = await chromium.launch();
  const results: Array<{ modal: string; overlaySel: string; viewport: string; m: Measurement; shot: string }> = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const page = await context.newPage();

    // Mandatory browser-log capture (per test procedure).
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`  [console.error] ${msg.text()}`);
    });
    page.on('pageerror', (err) => console.log(`  [pageerror] ${err.message}`));
    page.on('requestfailed', (req) => console.log(`  [requestfailed] ${req.url()} ${req.failure()?.errorText ?? ''}`));
    page.on('response', (res) => {
      if (res.status() >= 400) console.log(`  [response ${res.status()}] ${res.url()}`);
    });

    for (const modal of MODALS) {
      const url = `${WEB_URL}${modal.path ?? '/'}`;
      await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
      // Clicks are how you reach an overlay in an app with no debug gallery.
      // A click that misses is REPORTED, not skipped — otherwise the case
      // measures whatever was on screen instead and calls it a pass.
      let openFailure: string | null = null;
      for (const selector of modal.click ?? []) {
        try {
          await page.locator(selector).first().click({ timeout: 5000 });
          await page.waitForTimeout(120);
        } catch (error) {
          openFailure = `click "${selector}" failed: ${String(error).slice(0, 120)}`;
          break;
        }
      }
      if (openFailure) console.log(`  [open failed] ${modal.id}: ${openFailure}`);
      await page.waitForSelector(modal.waitFor ?? modal.overlay, { timeout: 5000 }).catch(() => {});
      // Let layout settle.
      await page.waitForTimeout(150);
      const m = await measure(page, modal.overlay, modal.card);
      // MARK=true outlines the measured card and says why it does not fit, in the screenshot.
      if (process.env.MARK === 'true' && m.found) {
        const why = m.fits ? 'FITS' : [
          m.cardTop < -1 ? `top ${-m.cardTop}px above screen` : '',
          m.cardBottom > m.viewportH + 1 ? `bottom ${m.cardBottom - m.viewportH}px below screen` : '',
          m.cardInnerOverflow > 2 ? `${m.cardInnerOverflow}px hidden inside` : '',
          m.overlayScrolls ? 'backdrop scrolls' : '',
        ].filter(Boolean).join(' · ');
        await page.evaluate(({ sel, why, ok }) => {
          const card = document.querySelector(sel) as HTMLElement;
          card.style.outline = `3px solid ${ok ? '#18a57b' : '#e5262d'}`;
          const tag = document.createElement('div');
          tag.textContent = why;
          tag.style.cssText = `position:fixed;left:0;right:0;top:0;z-index:2147483647;background:${ok ? '#18a57b' : '#e5262d'};color:#fff;font:700 12px/1.5 system-ui;padding:2px 8px;text-align:center`;
          document.body.appendChild(tag);
        }, { sel: modal.card ?? modal.overlay, why, ok: m.fits });
      }
      const shot = `${modal.id}__${vp.name}.png`;
      await page.screenshot({ path: join(OUT_DIR, shot) });
      results.push({ modal: modal.id, overlaySel: modal.overlay, viewport: vp.name, m, shot });
    }
    await context.close();
  }

  await browser.close();

  // ── Report ──
  console.log('\n=== MODAL FIT AUDIT ===');
  console.log(`web: ${WEB_URL}`);
  console.log(`screenshots: ${OUT_DIR}\n`);
  const fail: typeof results = [];
  for (const r of results) {
    const status = !r.m.found
      ? 'NOT-FOUND'
      : r.m.looksLikeBackdrop
        ? 'SUSPECT   '
        : r.m.fits ? 'OK ' : 'SCROLL/CLIP';
    if (!r.m.found || !r.m.fits || r.m.looksLikeBackdrop) fail.push(r);
    const detail = !r.m.found
      ? '(overlay element not found)'
      : r.m.looksLikeBackdrop
        ? `measured a full-screen element — set "card" to the dialog inside "${r.overlaySel}", or this case always passes`
        : `vh=${r.m.viewportH} cardTop=${r.m.cardTop} cardBottom=${r.m.cardBottom} cardH=${r.m.cardHeight} innerOverflow=${r.m.cardInnerOverflow} overlayScrolls=${r.m.overlayScrolls}`;
    console.log(`[${status}] ${r.modal.padEnd(26)} ${r.viewport.padEnd(20)} ${detail}`);
  }
  console.log(`\n${results.length - fail.length}/${results.length} fit cleanly.`);
  if (fail.length) {
    console.log(`\n${fail.length} PROBLEM CASES:`);
    for (const r of fail) console.log(`  - ${r.modal} @ ${r.viewport} → ${r.shot}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('modal-fit-audit failed:', err);
  process.exit(1);
});
