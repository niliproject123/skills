// screen-fit-marks - draws each hit onto the page before the screenshot, so the
// picture shows what the report says. Only with MARK=true; off, the screenshot is
// the page as it is. The marks are removed again after the screenshot.
//
// MOCKED DATA: none. Every box is a rect the run measured.
import type { Page } from '@playwright/test';

export type MarkKind = 'edge' | 'overlap' | 'spill' | 'clip' | 'small' | 'hole' | 'scroll';
export interface Mark { kind: MarkKind; x: number; y: number; w: number; h: number; label: string }

export const MARK_COLOURS: Record<MarkKind, string> = {
  edge: '#e5262d', overlap: '#ff7a00', spill: '#d6249f', clip: '#7b2ff7',
  small: '#e0b400', hole: '#1f8fff', scroll: '#00a39a',
};

type Box = { x: number; y: number; w: number; h: number };
type Raw = { left: number; top: number; right: number; bottom: number };
/** One mark per hit of a graded screen. Review-only kinds first, so the gating ones are drawn on top. */
export function buildMarks(found: {
  rects: Record<string, Box>; raws: Record<string, Raw>; scrolls: Record<string, { x: number; y: number }>;
  holes: Array<Box>; smalls: Array<{ id: string }>; edgeHits: Array<{ id: string; sides: string[] }>;
  hard: Array<{ x: number; y: number; ox: number; oy: number }>;
  spills: Array<{ child: string; overPx: number }>; clipped: Array<{ id: string; overPx: number }>;
}): Mark[] {
  const { rects, raws, scrolls } = found;
  const box = (r: Raw): Box => ({ x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top });
  return [
    ...found.holes.map((h): Mark => ({ kind: 'hole', x: h.x, y: h.y, w: h.w, h: h.h, label: `HOLE ${h.w}×${h.h}` })),
    ...found.smalls.map((s): Mark => ({ kind: 'small', ...rects[s.id]!, label: 'SMALL' })),
    ...Object.keys(scrolls).filter((id) => scrolls[id]!.x > 0)
      .map((id): Mark => ({ kind: 'scroll', ...rects[id]!, label: `SCROLLS SIDEWAYS ${scrolls[id]!.x}px` })),
    ...found.edgeHits.map((e): Mark => ({ kind: 'edge', ...rects[e.id]!, label: `EDGE ${e.sides.join('+')}` })),
    ...found.hard.map((o): Mark => ({ kind: 'overlap', x: o.x, y: o.y, w: o.ox, h: o.oy, label: 'OVERLAP' })),
    ...found.spills.map((s): Mark => ({ kind: 'spill', ...box(raws[s.child]!), label: `SPILL ${s.overPx}px` })),
    ...found.clipped.map((c): Mark => ({ kind: 'clip', ...box(raws[c.id]!), label: `CLIPPED ${c.overPx}px` })),
  ];
}

/** The empty % as a line for the screenshot; nothing when the check is off. */
export function emptyNote(emptyPct: number, band: [number, number] | null): { text: string; pass: boolean } | undefined {
  if (!band) return undefined;
  return { pass: emptyPct >= band[0] && emptyPct <= band[1],
    text: `EMPTY SPACE ${emptyPct.toFixed(1)}% of the screen · target ${band[0]}–${band[1]}%` };
}

/** `note` is a line under the page for a result that has no box of its own (the empty %). */
export async function drawMarks(page: Page, marks: Mark[], note?: { text: string; pass: boolean }): Promise<void> {
  if (note) {
    await page.evaluate((n: { text: string; pass: boolean }) => {
      const bar = document.createElement('div');
      bar.id = '__screen_fit_note';
      bar.textContent = n.text;
      bar.style.cssText = `background:${n.pass ? '#18a057' : '#e5262d'};color:#fff;padding:8px 12px;` +
        'font:700 13px/1.3 system-ui,sans-serif;text-align:center';
      document.body.appendChild(bar);
    }, note);
  }
  await page.evaluate(([list, colours]: [Mark[], Record<string, string>]) => {
    const layer = document.createElement('div');
    layer.id = '__screen_fit_marks';
    layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none';
    const sx = window.scrollX, sy = window.scrollY;
    for (const m of list) {
      const colour = colours[m.kind] ?? '#e5262d';
      const box = document.createElement('div');
      const dashed = m.kind === 'hole' || m.kind === 'scroll';
      box.style.cssText =
        `position:absolute;left:${m.x + sx}px;top:${m.y + sy}px;width:${m.w}px;height:${m.h}px;` +
        `border:3px ${dashed ? 'dashed' : 'solid'} ${colour};background:${colour}22;border-radius:4px`;
      const tag = document.createElement('div');
      tag.textContent = m.label;
      tag.style.cssText =
        `position:absolute;left:-3px;top:-3px;transform:translateY(-100%);background:${colour};color:#fff;` +
        'font:700 11px/1.3 system-ui,sans-serif;padding:2px 6px;border-radius:4px 4px 0 0;white-space:nowrap';
      if (m.y < 18) { tag.style.transform = 'none'; tag.style.borderRadius = '0 0 4px 0'; }
      box.appendChild(tag);
      layer.appendChild(box);
    }
    document.body.appendChild(layer);
  }, [marks, MARK_COLOURS] as [Mark[], Record<string, string>]);
}

/**
 * Makes every visible text unreadable while keeping its colour and place, so a screenshot of a
 * private app can be shown. Run AFTER the geometry is read: it changes paint only, never layout.
 * Not undone - the next navigation brings a fresh page. Images are blurred too (logos, photos).
 */
export async function blurText(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      if (el.closest('#__screen_fit_marks')) continue;
      const tag = el.tagName.toLowerCase();
      if (tag === 'img' || tag === 'video' || tag === 'canvas') { el.style.filter = 'blur(6px)'; continue; }
      const field = tag === 'input' || tag === 'textarea' || tag === 'select';
      const ownText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
      if (!field && !ownText) continue;
      const colour = getComputedStyle(el).color;
      el.style.setProperty('color', 'transparent', 'important');
      el.style.setProperty('text-shadow', `0 0 7px ${colour}, 0 0 3px ${colour}`, 'important');
      if (tag === 'text' || tag === 'tspan') el.style.filter = 'blur(4px)';
    }
    const hide = document.createElement('style');
    hide.textContent = '::placeholder{color:transparent!important}';
    document.head.appendChild(hide);
  });
}

export async function clearMarks(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('__screen_fit_marks')?.remove();
    document.getElementById('__screen_fit_note')?.remove();
  });
}
