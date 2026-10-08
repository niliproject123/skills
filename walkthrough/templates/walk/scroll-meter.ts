// The scroll meter — how far the page scrolled during one step, summed, whoever scrolled it (the walk
// bringing a control into view, or the person watching). Shown on the strip at the step's end and written
// into the report row: a step that costs ten screens of scrolling is a finding about the screen.
//
// A `scroll` listener in the capture phase on the document hears the window's scroll and every scrolled
// element's (a `scroll` on an element does not bubble, but the capture path passes the document). Each
// target's last position is kept; every event adds |Δtop| + |Δleft|. The total lives in sessionStorage,
// so it survives a navigation and a sign-out reload inside the step. A scroll inside the overlay's closed
// shadow root is not composed and never reaches the document, so the steps list is not counted.
// An iframe posts its distances to the top document, which adds them.
//
// A reading that fails is not a zero: it is thrown by name, and the runner shows it in red and records it.
import type { Page } from 'playwright';
import { WalkError } from './types';

export const SCROLL_METER_SCRIPT = String.raw`
(() => {
  if (window.__walkScrollMeter) return;
  const STORE = 'walk.scrolled';
  const MESSAGE = 'walkScrolledPixels';
  const atTheTop = window.top === window;
  const last = new WeakMap();
  let failure = '';
  const add = (pixels) => {
    if (!(pixels > 0)) return;
    try {
      sessionStorage.setItem(STORE, String(Number(sessionStorage.getItem(STORE) || '0') + pixels));
    } catch (error) {
      failure = 'the scroll total could not be kept in sessionStorage: ' + (error && error.message ? error.message : String(error));
    }
  };
  document.addEventListener('scroll', (event) => {
    const target = event.target;
    if (target && target.tagName === 'WALK-OVERLAY') return;
    const element = target === document ? (document.scrollingElement || document.documentElement) : target;
    if (!element || typeof element.scrollTop !== 'number') return;
    const was = last.get(element) || { top: 0, left: 0 };
    const now = { top: element.scrollTop, left: element.scrollLeft };
    last.set(element, now);
    const moved = Math.abs(now.top - was.top) + Math.abs(now.left - was.left);
    if (atTheTop) add(moved);
    else if (moved > 0) window.top.postMessage({ [MESSAGE]: moved }, '*');
  }, { capture: true, passive: true });
  if (!atTheTop) return;
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data && typeof data === 'object' && typeof data[MESSAGE] === 'number') add(data[MESSAGE]);
  });
  window.__walkScrollMeter = {
    reset() { failure = ''; sessionStorage.setItem(STORE, '0'); },
    read() { return { kept: sessionStorage.getItem(STORE), screenHeight: window.innerHeight, failure }; },
  };
})();
`;

export interface ScrollReading {
  pixels: number;
  screens: number;
}

/** The total back to 0, at the step's start. */
export async function resetScroll(page: Page): Promise<void> {
  const done = await page.evaluate(() => {
    const meter = (window as unknown as { __walkScrollMeter?: { reset(): void } }).__walkScrollMeter;
    if (!meter) return false;
    meter.reset();
    return true;
  });
  if (!done) throw new WalkError('scroll.no_meter', 'the scroll meter is not on this page — SCROLL_METER_SCRIPT was not added to its context');
}

/** The total since the reset. One animation frame first, so a scroll that just happened has been heard. */
export async function readScroll(page: Page): Promise<ScrollReading> {
  const answer = await page.evaluate(async () => {
    const meter = (window as unknown as { __walkScrollMeter?: { read(): { kept: string | null; screenHeight: number; failure: string } } }).__walkScrollMeter;
    if (!meter) return null;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return meter.read();
  });
  if (!answer) throw new WalkError('scroll.no_meter', 'the scroll meter is not on this page');
  if (answer.failure) throw new WalkError('scroll.not_kept', answer.failure);
  if (answer.kept === null) throw new WalkError('scroll.total_gone', 'the scroll total is gone from sessionStorage — something emptied it after the step reset it');
  const pixels = Number(answer.kept);
  if (!Number.isFinite(pixels) || pixels < 0) throw new WalkError('scroll.unreadable', `the scroll total is "${answer.kept}", not a distance`);
  if (!(answer.screenHeight > 0)) throw new WalkError('scroll.no_height', `window.innerHeight is ${answer.screenHeight}`);
  return { pixels: Math.round(pixels), screens: pixels / answer.screenHeight };
}
