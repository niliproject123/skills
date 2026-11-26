# screen-fit — real-DOM layout grading

Web: http://127.0.0.1:4517. Mocked: none of the geometry.
Criteria: (1) zero collisions [hard, always on]
(2) empty 10-15% target 15%
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
| phone | /board.html?tab=reports | 43 | 0 | 0 | 1 | 0 | 0 | 51.0 | 380x188 | 1 (1) | 0 | FAIL | FAIL | PASS |

## phone /board.html?tab=reports
- SPILL span pokes 12px past #btn-export (left+right)
- HOLE  380x188px of nothing at (8,550) inside page — review
- SCROLL #workload-scroll does not fit itself — scrolls sideways by 276px — review
