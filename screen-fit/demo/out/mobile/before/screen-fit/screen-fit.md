# screen-fit — real-DOM layout grading

Web: http://127.0.0.1:4517. Mocked: none of the geometry.
Criteria: (1) zero collisions [hard, always on]
(2) empty space — off for this run (EMPTY_BAND=off)
(3) button min side >= 3% of viewport short side.

Overlaps are split: `overlap` = both elements in normal flow (a real bug,
gates criterion 1). `overlay?` = one is absolutely placed, i.e. deliberately
drawn on top (badge on an avatar). Those are listed for review, not gated —
no automated check can tell a designed overlay from a mistake.

`spill` = content whose real box pokes out past the button/card that
holds it (coin wider than its tile, image past a card edge).

`clip` = an interactive element cut off by a container that HIDES its
overflow, so it cannot be scrolled into view — it is simply gone. Scroll
containers are exempt: content you can reach is not lost.

All four gate criterion 1 — they are what "nothing crosses nothing" means.

`HOLE` = the largest rectangle of nothing INSIDE the content, with both sides at
least HOLE_MIN_SIDE px. The empty % cannot see one: it is a ratio, so a band of
nothing under a table and the same pixels spread thinly between its rows score the
same. Reported for review, never gated — a deliberate gap is not a bug. Page
margins are excluded: holes are measured inside the content own bounding box.

`SCROLL` = an element whose own content does not fit inside it, so it carries a
scrollbar. Only axes whose overflow is auto/scroll count: overflow:hidden also
reports content past the box, but that is a cell truncating with an ellipsis and
keeping its value in the title. Reported for review, never gated — a list column
that scrolls is the design; a form card that scrolls usually is not.

| viewport | route | elements | edge | overlap | spill | clip | overlay? | empty % | biggest hole | scrolls (x) | small btns | c1 | c2 | c3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| phone | /board.html | 58 | 1 | 1 | 0 | 1 | 0 | 31.7 | - | 0 (0) | 4 | FAIL | off | FAIL |
| phone | /board.html?tab=reports | 43 | 0 | 0 | 1 | 0 | 0 | 51.0 | 380x188 | 1 (1) | 0 | FAIL | off | PASS |
| compact | /board.html | 58 | 0 | 2 | 0 | 0 | 0 | 44.5 | 228x212 | 0 (0) | 4 | FAIL | off | FAIL |
| compact | /board.html?tab=reports | 53 | 0 | 0 | 1 | 0 | 0 | 48.3 | 656x188 | 0 (0) | 0 | FAIL | off | PASS |
| phoneWide | /board.html | 58 | 0 | 1 | 0 | 0 | 0 | 45.7 | 312x212 | 0 (0) | 4 | FAIL | off | FAIL |
| phoneWide | /board.html?tab=reports | 53 | 0 | 0 | 1 | 0 | 0 | 47.9 | 740x188 | 0 (0) | 0 | FAIL | off | PASS |
| tabletUp | /board.html | 58 | 0 | 1 | 0 | 0 | 0 | 62.2 | 328x212 | 0 (0) | 4 | FAIL | off | FAIL |
| tabletUp | /board.html?tab=reports | 53 | 0 | 0 | 1 | 0 | 0 | 49.5 | 760x188 | 0 (0) | 0 | FAIL | off | PASS |

## phone /board.html
- EDGE  #kpi-blocked crosses right
- OVER  span x span.pill.review — 33x20px
- CLIP  #btn-share cut off 20px by #toolbar (right)
- SMALL #chip-all — tap target 46x30px (min 44x44)
- SMALL #chip-mine — tap target 61x30px (min 44x44)
- SMALL #chip-blocked — tap target 79x30px (min 44x44)
- SMALL #chip-review — tap target 85x30px (min 44x44)

## phone /board.html?tab=reports
- SPILL span pokes 12px past #btn-export (left+right)
- HOLE  380x188px of nothing at (8,550) inside page — review
- SCROLL #workload-scroll does not fit itself — scrolls sideways by 276px — review

## compact /board.html
- OVER  span x span.pill.review — 67x20px
- OVER  span~3 x span.pill.blocked — 16x20px
- SMALL #chip-all — tap target 46x30px (min 44x44)
- SMALL #chip-mine — tap target 61x30px (min 44x44)
- SMALL #chip-blocked — tap target 79x30px (min 44x44)
- SMALL #chip-review — tap target 85x30px (min 44x44)
- HOLE  228x212px of nothing at (432,210) inside page — review

## compact /board.html?tab=reports
- SPILL span pokes 12px past #btn-export (left+right)
- HOLE  656x188px of nothing at (8,550) inside page — review

## phoneWide /board.html
- OVER  span x span.pill.review — 37x20px
- SMALL #chip-all — tap target 46x30px (min 44x44)
- SMALL #chip-mine — tap target 61x30px (min 44x44)
- SMALL #chip-blocked — tap target 79x30px (min 44x44)
- SMALL #chip-review — tap target 85x30px (min 44x44)
- HOLE  312x212px of nothing at (432,210) inside page — review

## phoneWide /board.html?tab=reports
- SPILL span pokes 12px past #btn-export (left+right)
- HOLE  740x188px of nothing at (8,550) inside page — review

## tabletUp /board.html
- OVER  span x span.pill.review — 28x20px
- SMALL #chip-all — tap target 46x30px (min 44x44)
- SMALL #chip-mine — tap target 61x30px (min 44x44)
- SMALL #chip-blocked — tap target 79x30px (min 44x44)
- SMALL #chip-review — tap target 85x30px (min 44x44)
- HOLE  328x212px of nothing at (432,210) inside page — review

## tabletUp /board.html?tab=reports
- SPILL span pokes 12px past #btn-export (left+right)
- HOLE  760x188px of nothing at (8,550) inside page — review
