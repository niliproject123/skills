// Geometry/layout analyzers. Copied unchanged from
// c:/dev/backgammon/main/tests/specific/screen-fit-analyzers.ts, which itself
// ported them logic-for-logic from an interactive sandbox that graded
// hand-dragged synthetic boxes. Nothing in here knows about any app.
//
// They run in Node, not in the browser: the probe extracts plain rects via
// page.evaluate and hands them here. That is deliberate — injected evaluate
// bodies may only contain anonymous inline arrows (a named inner function emits
// esbuild's __name() wrapper, which throws ReferenceError in the browser).
//
// MOCKED DATA: none. Pure functions over measured geometry.

export interface Rect { x: number; y: number; w: number; h: number }
export interface Meta { container: boolean; hasText: boolean; interactive: boolean }
export type RectMap = Record<string, Rect>;
export type MetaMap = Record<string, Meta>;

export function clip(r: Rect, c: Rect): Rect | null {
  const x = Math.max(r.x, c.x);
  const y = Math.max(r.y, c.y);
  const x2 = Math.min(r.x + r.w, c.x + c.w);
  const y2 = Math.min(r.y + r.h, c.y + c.h);
  return x2 > x && y2 > y ? { x, y, w: x2 - x, h: y2 - y } : null;
}

/** Exact union area of rectangles (coordinate-compression sweep). */
export function unionArea(rects: Rect[]): number {
  if (!rects.length) return 0;
  const xs = [...new Set(rects.flatMap((r) => [r.x, r.x + r.w]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const x1 = xs[i]!;
    const x2 = xs[i + 1]!;
    const w = x2 - x1;
    if (w <= 0) continue;
    const ints = rects
      .filter((r) => r.x <= x1 + 0.01 && r.x + r.w >= x2 - 0.01)
      .map((r) => [r.y, r.y + r.h] as const)
      .sort((a, b) => a[0] - b[0]);
    let covered = 0;
    let s: number | null = null;
    let e: number | null = null;
    for (const [is_, ie] of ints) {
      if (e === null) { s = is_; e = ie; }
      else if (is_ <= e) { e = Math.max(e, ie); }
      else { covered += e - s!; s = is_; e = ie; }
    }
    if (e !== null) covered += e - s!;
    area += covered * w;
  }
  return area;
}

export function interArea(a: Rect, b: Rect): number {
  const c = clip(a, b);
  return c ? c.w * c.h : 0;
}

export interface EdgeHit { id: string; sides: string[] }
export interface Overlap { a: string; b: string; x: number; y: number; ox: number; oy: number; area: number }

/**
 * Criterion 1 — "nothing crosses nothing".
 * Two failure kinds: an element crossing a viewport edge, and two elements
 * overlapping. Nesting is exempt: a smaller element sitting >=95% inside a
 * container is layering (graph in card), not a collision.
 */
export function detectViolations(
  rects: RectMap, meta: MetaMap, canvasW: number, canvasH: number,
  /**
   * id -> ids of its kept DOM ancestors. The sandbox had no DOM tree, so it
   * approximated layering with the `container` flag + a 95%-inside test. Real
   * DOM gives us the truth: if one element contains the other, they are layered
   * by construction (icon inside button, everything inside a background div)
   * and can never be a collision. Without this, one full-bleed background layer
   * reports a collision against every element on the page.
   */
  ancestors: Record<string, string[]> = {},
): { edgeHits: EdgeHit[]; overlaps: Overlap[] } {
  const ids = Object.keys(rects);
  const edgeHits: EdgeHit[] = [];
  const overlaps: Overlap[] = [];

  for (const id of ids) {
    const r = rects[id]!;
    const sides: string[] = [];
    if (r.x < -0.5) sides.push('left');
    if (r.y < -0.5) sides.push('top');
    if (r.x + r.w > canvasW + 0.5) sides.push('right');
    if (r.y + r.h > canvasH + 0.5) sides.push('bottom');
    if (sides.length) edgeHits.push({ id, sides });
  }

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const A = rects[ids[i]!]!;
      const B = rects[ids[j]!]!;
      const ia = interArea(A, B);
      if (ia <= 0.5) continue;
      const idA = ids[i]!;
      const idB = ids[j]!;
      if (ancestors[idA]?.includes(idB) || ancestors[idB]?.includes(idA)) continue;
      const smaller = A.w * A.h <= B.w * B.h ? A : B;
      const outer = smaller === A ? ids[j]! : ids[i]!;
      const nested = meta[outer]?.container && ia >= 0.95 * (smaller.w * smaller.h);
      if (nested) continue;
      const c = clip(A, B)!;
      overlaps.push({
        a: ids[i]!, b: ids[j]!, x: c.x, y: c.y,
        ox: Math.round(c.w), oy: Math.round(c.h), area: Math.round(ia),
      });
    }
  }
  return { edgeHits, overlaps };
}

export interface Emptiness {
  page: { area: number; filled: number; emptyPct: number };
  containers: { id: string; area: number; filled: number; emptyPct: number }[];
}

/**
 * Criterion 2 — empty space.
 * Rule from the sandbox: containers (backgrounds, cards) ARE empty space; only
 * content fills. So page empty = page area - union(content clipped to page).
 */
export function analyzeEmptiness(
  rects: RectMap, meta: MetaMap, canvasW: number, canvasH: number,
): Emptiness {
  const contentRects = Object.keys(rects)
    .filter((id) => !meta[id]?.container)
    .map((id) => rects[id]!);

  const page: Rect = { x: 0, y: 0, w: canvasW, h: canvasH };
  const pageFilled = unionArea(contentRects.map((r) => clip(r, page)).filter((r): r is Rect => !!r));
  const pageArea = canvasW * canvasH;

  const containers = Object.keys(rects)
    .filter((id) => meta[id]?.container)
    .map((id) => {
      const r = rects[id]!;
      const filled = unionArea(contentRects.map((c) => clip(c, r)).filter((x): x is Rect => !!x));
      const area = r.w * r.h;
      return {
        id, area: Math.round(area), filled: Math.round(filled),
        emptyPct: area > 0 ? ((area - filled) / area) * 100 : 0,
      };
    });

  return {
    page: {
      area: Math.round(pageArea), filled: Math.round(pageFilled),
      emptyPct: pageArea > 0 ? ((pageArea - pageFilled) / pageArea) * 100 : 0,
    },
    containers,
  };
}

export interface RawRect { left: number; top: number; right: number; bottom: number }
export interface Spill { child: string; card: string; sides: string[]; overPx: number }

/**
 * "Nothing crosses nothing" applies to CARD edges too, not just the viewport.
 * A label/coin/image whose real (unclipped) box pokes out past the button or
 * card that contains it looks broken even though it never reaches the viewport
 * edge. The viewport-edge check and the nesting-exempt overlap check both miss
 * this — nesting is exactly what they wave through.
 *
 * For each content element, find its nearest enclosing interactive card that
 * does NOT clip its overflow, and flag the child if its raw box extends past
 * that card by more than `tol` on any side.
 */
export function detectSpill(
  raws: Record<string, RawRect>,
  meta: MetaMap,
  ancestors: Record<string, string[]>,
  clips: Record<string, boolean>,
  rects: RectMap,
  tol = 2,
): Spill[] {
  const out: Spill[] = [];
  const areaOf = (id: string): number => {
    const r = rects[id];
    return r ? r.w * r.h : Infinity;
  };
  for (const child of Object.keys(raws)) {
    const m = meta[child];
    if (!m) continue;
    // Content (text / images / controls) is what visibly spills. A pure
    // background/container spilling is not the reported bug — and it must NOT be
    // an area heuristic: the flanking indicator IMAGES are large content and are
    // exactly what pokes out of the card.
    if (m.container) continue;
    // nearest enclosing card = smallest-area interactive ancestor that does
    // not clip (a clipping card would hide the spill, not show it)
    const cards = (ancestors[child] ?? [])
      .filter((a) => meta[a]?.interactive && !clips[a])
      .sort((a, b) => areaOf(a) - areaOf(b));
    const card = cards[0];
    if (!card) continue;
    const c = raws[child]!;
    const p = raws[card]!;
    const sides: string[] = [];
    let over = 0;
    if (c.left < p.left - tol) { sides.push('left'); over = Math.max(over, p.left - c.left); }
    if (c.top < p.top - tol) { sides.push('top'); over = Math.max(over, p.top - c.top); }
    if (c.right > p.right + tol) { sides.push('right'); over = Math.max(over, c.right - p.right); }
    if (c.bottom > p.bottom + tol) { sides.push('bottom'); over = Math.max(over, c.bottom - p.bottom); }
    if (sides.length) out.push({ child, card, sides, overPx: Math.round(over) });
  }
  return out;
}

export interface Clipped { id: string; card: string; sides: string[]; overPx: number }

/**
 * "Nothing crosses nothing" has a third failure the edge- and spill-checks both
 * miss: a control that is CUT OFF by a non-scrollable ancestor. The probe clips
 * every element's measured rect to its `overflow:hidden` ancestors (to stop a
 * collapsed picker inventing collisions) — but that same clipping hides a
 * genuinely truncated button: its clipped box fits, so no edge-hit fires, and
 * detectSpill exempts clipping cards by construction.
 *
 * `hiddenVis` is each element's box clipped to ONLY its overflow:hidden/clip
 * ancestors (NOT overflow:auto/scroll — content in a scroll container is
 * reachable by scrolling, so a scroll-clip is not a bug). If an interactive
 * control's hidden-clipped box is smaller than its real box by more than `tol`
 * on any side, part of that control can never be seen or clicked — a bug.
 * Scoped to interactive controls: text is routinely ellipsis-clipped on purpose.
 */
export function detectClipped(
  raws: Record<string, RawRect>,
  hiddenVis: Record<string, RawRect>,
  meta: MetaMap,
  clipper: Record<string, string>,
  tol = 2,
): Clipped[] {
  const out: Clipped[] = [];
  for (const id of Object.keys(raws)) {
    if (!meta[id]?.interactive) continue;
    const r = raws[id]!;
    const v = hiddenVis[id];
    if (!v) continue;
    const sides: string[] = [];
    let over = 0;
    if (v.left > r.left + tol) { sides.push('left'); over = Math.max(over, v.left - r.left); }
    if (v.top > r.top + tol) { sides.push('top'); over = Math.max(over, v.top - r.top); }
    if (v.right < r.right - tol) { sides.push('right'); over = Math.max(over, r.right - v.right); }
    if (v.bottom < r.bottom - tol) { sides.push('bottom'); over = Math.max(over, r.bottom - v.bottom); }
    if (sides.length) out.push({ id, card: clipper[id] ?? '?', sides, overPx: Math.round(over) });
  }
  return out;
}

export interface SmallHit { id: string; reasons: string[]; pct: number; minSidePct: number }

/**
 * Criterion 3 — "buttons must not look small on a big screen".
 * Michael's intent is SCALE, not absolute pixels: a button should hold its
 * proportion of the viewport as the viewport grows. So the primary measure is
 * the button's smaller dimension as a % of the viewport's shorter side.
 * The 44px tap-target floor from the sandbox is kept as a hard accessibility
 * minimum on top of it.
 */
export function detectSmall(
  rects: RectMap, meta: MetaMap, canvasW: number, canvasH: number, minSidePct: number,
): SmallHit[] {
  const screenArea = canvasW * canvasH;
  const shortSide = Math.min(canvasW, canvasH);
  if (screenArea <= 0) return [];
  const out: SmallHit[] = [];
  for (const id of Object.keys(rects)) {
    if (!meta[id]?.interactive) continue;
    const r = rects[id]!;
    const pct = ((r.w * r.h) / screenArea) * 100;
    const sidePct = (Math.min(r.w, r.h) / shortSide) * 100;
    const reasons: string[] = [];
    if (sidePct < minSidePct) {
      reasons.push(`${sidePct.toFixed(1)}% of short side (min ${minSidePct}%)`);
    }
    if (r.w < 44 || r.h < 44) {
      reasons.push(`tap target ${Math.round(r.w)}x${Math.round(r.h)}px (min 44x44)`);
    }
    if (reasons.length) out.push({ id, reasons, pct, minSidePct: sidePct });
  }
  return out;
}

export interface Hole { x: number; y: number; w: number; h: number; inside: string }

/**
 * Holes — the largest rectangles of nothing sitting *inside* the laid-out content.
 *
 * Criterion 2 answers "how much of the screen is empty" with one number for the whole page, and
 * that number cannot see a hole: it is a ratio, so a band of nothing in the middle of a panel
 * scores the same as the same number of pixels spread thinly between rows of a table. A 1020x133
 * band under one table of מסך 16 appeared and was removed without moving the page figure by a
 * tenth of a percent — that is what this is for.
 *
 * Method: rasterise the bounding box of all content, mark every cell a content box covers, then
 * take the largest all-empty rectangle, blank it out, and take the next. Margins around the page
 * are excluded by working inside the content's own bounding box rather than the viewport, so the
 * page's own gutters are never reported as holes.
 *
 * Reported, never gated. A dashboard with a deliberate gap is not a bug, and no measurement can
 * tell that from an accident — the same rule criterion 1 uses for `overlay?`.
 */
export function analyzeHoles(
  rects: RectMap, meta: MetaMap, canvasW: number, canvasH: number,
  minSidePx = 80, want = 3, cellPx = 4,
): Hole[] {
  const page: Rect = { x: 0, y: 0, w: canvasW, h: canvasH };
  const content: Rect[] = [];
  for (const id of Object.keys(rects)) {
    if (meta[id]?.container) continue;
    const c = clip(rects[id]!, page);
    if (c && c.w > 0 && c.h > 0) content.push(c);
  }
  if (content.length === 0) return [];

  // The box the content actually occupies. Anything outside it is margin, not a hole.
  const x0 = Math.min(...content.map((r) => r.x));
  const y0 = Math.min(...content.map((r) => r.y));
  const x1 = Math.max(...content.map((r) => r.x + r.w));
  const y1 = Math.max(...content.map((r) => r.y + r.h));
  const cols = Math.ceil((x1 - x0) / cellPx);
  const rows = Math.ceil((y1 - y0) / cellPx);
  if (cols <= 0 || rows <= 0) return [];

  const filled = new Uint8Array(cols * rows);
  for (const r of content) {
    const cx0 = Math.max(0, Math.floor((r.x - x0) / cellPx));
    const cy0 = Math.max(0, Math.floor((r.y - y0) / cellPx));
    const cx1 = Math.min(cols, Math.ceil((r.x + r.w - x0) / cellPx));
    const cy1 = Math.min(rows, Math.ceil((r.y + r.h - y0) / cellPx));
    for (let y = cy0; y < cy1; y += 1) for (let x = cx0; x < cx1; x += 1) filled[y * cols + x] = 1;
  }

  // The containers a hole can be reported against — the smallest one that holds it.
  const boxes = Object.keys(rects)
    .filter((id) => meta[id]?.container)
    .map((id) => ({ id, r: rects[id]! }))
    .sort((a, b) => a.r.w * a.r.h - b.r.w * b.r.h);

  const out: Hole[] = [];
  const minCells = Math.ceil(minSidePx / cellPx);
  for (let round = 0; round < want; round += 1) {
    // Largest all-empty rectangle: a histogram of empty depth per column, per row.
    const depth = new Int32Array(cols);
    let best = { area: 0, x: 0, y: 0, w: 0, h: 0 };
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) depth[x] = filled[y * cols + x] ? 0 : depth[x] + 1;
      const stack: number[] = [];
      for (let x = 0; x <= cols; x += 1) {
        const here = x === cols ? 0 : depth[x]!;
        while (stack.length && depth[stack[stack.length - 1]!]! >= here) {
          const top = stack.pop()!;
          const height = depth[top]!;
          const left = stack.length ? stack[stack.length - 1]! + 1 : 0;
          const width = x - left;
          if (height >= minCells && width >= minCells && width * height > best.area) {
            best = { area: width * height, x: left, y: y - height + 1, w: width, h: height };
          }
        }
        stack.push(x);
      }
    }
    if (best.area === 0) break;
    const hole: Rect = {
      x: x0 + best.x * cellPx, y: y0 + best.y * cellPx,
      w: best.w * cellPx, h: best.h * cellPx,
    };
    const holder = boxes.find(
      (b) => b.r.x <= hole.x + 1 && b.r.y <= hole.y + 1
        && b.r.x + b.r.w >= hole.x + hole.w - 1 && b.r.y + b.r.h >= hole.y + hole.h - 1,
    );
    out.push({
      x: Math.round(hole.x), y: Math.round(hole.y),
      w: Math.round(hole.w), h: Math.round(hole.h),
      inside: holder?.id ?? 'page',
    });
    for (let y = best.y; y < best.y + best.h; y += 1) {
      for (let x = best.x; x < best.x + best.w; x += 1) filled[y * cols + x] = 1;
    }
  }
  return out;
}
