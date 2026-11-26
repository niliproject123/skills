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
| phone | /board.html | 54 | 3 | 76 | 24 | 1 | 0 | 75.5 | 348x96 | 0 (0) | 8 | FAIL | off | FAIL |
| phone | /board.html?fixed | 38 | 0 | 0 | 0 | 0 | 0 | 52.2 | 168x104 | 0 (0) | 0 | PASS | off | PASS |
| tablet | /board.html | 70 | 3 | 16 | 6 | 0 | 0 | 66.9 | 204x292 | 0 (0) | 5 | FAIL | off | FAIL |
| tablet | /board.html?fixed | 70 | 0 | 0 | 0 | 0 | 0 | 45.3 | 296x96 | 0 (0) | 0 | PASS | off | PASS |
| laptop | /board.html | 70 | 0 | 0 | 2 | 0 | 0 | 73.5 | 316x292 | 0 (0) | 5 | FAIL | off | FAIL |
| laptop | /board.html?fixed | 70 | 0 | 0 | 0 | 0 | 0 | 70.3 | 324x368 | 0 (0) | 0 | PASS | off | PASS |

## phone /board.html
- EDGE  #kpi-progress crosses right
- EDGE  div.label~2 crosses right
- EDGE  div.value~2 crosses right
- OVER  #timeline x #activity — 300x128px
- OVER  div.bar.a x #activity — 300x26px
- OVER  div.bar.a x p — 270x17px
- OVER  div.bar.a x b~2 — 36x16px
- OVER  div.bar.a x i — 109x16px
- OVER  div.bar.a x p~2 — 270x1px
- OVER  div.bar.a x b~3 — 30x1px
- OVER  div.bar.a x i~2 — 93x1px
- OVER  div.bar.b x #activity — 78x26px
- OVER  div.bar.b x p~2 — 63x14px
- OVER  div.bar.b x i~2 — 25x13px
- OVER  #task-1 x #task-2 — 16x93px
- OVER  #task-1 x span.title~2 — 1x21px
- OVER  #task-1 x span.chip~2 — 1x22px
- OVER  #task-1 x #task-3 — 2x93px
- OVER  span.title x #task-2 — 29x21px
- OVER  span.title x span.title~2 — 322x21px
- OVER  span.title x #task-3 — 30x21px
- OVER  span.title x span.title~3 — 250x21px
- OVER  span.title x #activity — 300x21px
- OVER  span.chip x #task-2 — 29x22px
- OVER  span.chip x span.chip~2 — 40x22px
- OVER  span.chip x #task-3 — 30x22px
- OVER  span.chip x span.chip~3 — 37x22px
- OVER  span.chip x #activity — 38x22px
- OVER  #t1-edit x #t2-edit — 15x26px
- OVER  #t1-edit x #t2-more — 5x26px
- OVER  #t1-edit x #t3-edit — 7x26px
- OVER  #t1-more x #t2-more — 15x26px
- OVER  #t1-more x #t3-edit — 13x26px
- OVER  #t1-more x #t3-more — 7x26px
- OVER  #task-2 x #task-3 — 16x93px
- OVER  #task-2 x span.title~3 — 1x21px
- OVER  #task-2 x span.chip~3 — 1x22px
- OVER  #task-2 x #activity — 2x93px
- OVER  span.title~2 x #task-3 — 29x21px
- OVER  span.title~2 x span.title~3 — 250x21px
- OVER  span.title~2 x #activity — 300x21px
- OVER  span.chip~2 x #task-3 — 29x22px
- OVER  span.chip~2 x span.chip~3 — 26x22px
- OVER  span.chip~2 x #activity — 27x22px
- OVER  #t2-more x #t3-edit — 24x26px
- OVER  #task-3 x #activity — 16x93px
- OVER  #task-4 x #task-5 — 16x93px
- OVER  #task-4 x span.title~5 — 1x21px
- OVER  #task-4 x span.chip~5 — 1x22px
- OVER  #task-4 x #task-6 — 2x93px
- OVER  span.title~4 x #task-5 — 29x21px
- OVER  span.title~4 x span.title~5 — 239x21px
- OVER  span.title~4 x #task-6 — 30x21px
- OVER  span.title~4 x span.title~6 — 225x21px
- OVER  span.title~4 x #activity — 226x21px
- OVER  span.chip~4 x #task-5 — 29x22px
- OVER  span.chip~4 x span.chip~5 — 40x22px
- OVER  span.chip~4 x #task-6 — 30x22px
- OVER  span.chip~4 x span.chip~6 — 37x22px
- OVER  span.chip~4 x #activity — 38x22px
- OVER  #t4-edit x #t5-edit — 15x26px
- OVER  #t4-edit x #t5-more — 5x26px
- OVER  #t4-edit x #t6-edit — 21x26px
- OVER  #t4-more x #t5-more — 15x26px
- OVER  #t4-more x #t6-more — 21x26px
- OVER  #task-5 x #task-6 — 16x93px
- OVER  #task-5 x span.title~6 — 1x21px
- OVER  #task-5 x span.chip~6 — 1x22px
- OVER  #task-5 x #activity — 2x93px
- OVER  span.title~5 x #task-6 — 29x21px
- OVER  span.title~5 x span.title~6 — 282x21px
- OVER  span.chip~5 x #task-6 — 29x22px
- OVER  span.chip~5 x span.chip~6 — 26x22px
- OVER  span.chip~5 x #activity — 27x22px
- OVER  #t5-edit x #t6-edit — 11x26px
- OVER  #t5-more x #t6-edit — 9x26px
- OVER  #t5-more x #t6-more — 11x26px
- OVER  #task-6 x #activity — 16x93px
- OVER  span.title~6 x #activity — 299x21px
- SPILL span.title pokes 321px past #task-1 (right)
- SPILL span.chip pokes 50px past #task-1 (right)
- SPILL #t1-edit pokes 109px past #task-1 (right)
- SPILL #t1-more pokes 141px past #task-1 (right)
- SPILL span.title~2 pokes 316px past #task-2 (right)
- SPILL span.chip~2 pokes 25px past #task-2 (right)
- SPILL #t2-edit pokes 84px past #task-2 (right)
- SPILL #t2-more pokes 116px past #task-2 (right)
- SPILL span.title~3 pokes 235px past #task-3 (right)
- SPILL span.chip~3 pokes 41px past #task-3 (right)
- SPILL #t3-edit pokes 100px past #task-3 (right)
- SPILL #t3-more pokes 132px past #task-3 (right)
- SPILL span.title~4 pokes 238px past #task-4 (right)
- SPILL span.chip~4 pokes 50px past #task-4 (right)
- SPILL #t4-edit pokes 109px past #task-4 (right)
- SPILL #t4-more pokes 141px past #task-4 (right)
- SPILL span.title~5 pokes 281px past #task-5 (right)
- SPILL span.chip~5 pokes 25px past #task-5 (right)
- SPILL #t5-edit pokes 84px past #task-5 (right)
- SPILL #t5-more pokes 116px past #task-5 (right)
- SPILL span.title~6 pokes 321px past #task-6 (right)
- SPILL span.chip~6 pokes 26px past #task-6 (right)
- SPILL #t6-edit pokes 86px past #task-6 (right)
- SPILL #t6-more pokes 118px past #task-6 (right)
- CLIP  #btn-share cut off 91px by #toolbar (left)
- SMALL #btn-share — tap target 37x40px (min 44x44)
- SMALL #btn-new — tap target 128x40px (min 44x44)
- SMALL #task-1 — tap target 30x93px (min 44x44)
- SMALL #task-2 — tap target 30x93px (min 44x44)
- SMALL #task-3 — tap target 30x93px (min 44x44)
- SMALL #task-4 — tap target 30x93px (min 44x44)
- SMALL #task-5 — tap target 30x93px (min 44x44)
- SMALL #task-6 — tap target 30x93px (min 44x44)
- HOLE  348x96px of nothing at (44,300) inside page — review
- HOLE  176x84px of nothing at (216,432) inside page — review

## phone /board.html?fixed
- HOLE  168x104px of nothing at (24,100) inside page — review
- HOLE  108x96px of nothing at (24,476) inside page — review
- HOLE  92x88px of nothing at (276,420) inside page — review

## tablet /board.html
- EDGE  #kpi-velocity crosses right
- EDGE  div.label~4 crosses right
- EDGE  div.value~4 crosses right
- OVER  #timeline x #activity — 184x128px
- OVER  #timeline x p — 169x21px
- OVER  #timeline x i — 79x20px
- OVER  #timeline x p~2 — 169x21px
- OVER  #timeline x i~2 — 30x20px
- OVER  div.bar.c x #activity — 111x26px
- OVER  span.title x #task-2 — 129x21px
- OVER  span.title x span.title~2 — 114x21px
- OVER  span.title~2 x #task-3 — 124x21px
- OVER  span.title~2 x span.title~3 — 109x21px
- OVER  span.title~3 x #activity — 33x21px
- OVER  span.title~4 x #task-5 — 46x21px
- OVER  span.title~4 x span.title~5 — 31x21px
- OVER  span.title~5 x #task-6 — 89x21px
- OVER  span.title~5 x span.title~6 — 74x21px
- OVER  span.title~6 x #activity — 119x21px
- SPILL span.title pokes 143px past #task-1 (right)
- SPILL span.title~2 pokes 138px past #task-2 (right)
- SPILL span.title~3 pokes 57px past #task-3 (right)
- SPILL span.title~4 pokes 60px past #task-4 (right)
- SPILL span.title~5 pokes 103px past #task-5 (right)
- SPILL span.title~6 pokes 143px past #task-6 (right)
- SMALL #btn-filter — tap target 128x40px (min 44x44)
- SMALL #btn-group — tap target 128x40px (min 44x44)
- SMALL #btn-export — tap target 128x40px (min 44x44)
- SMALL #btn-share — tap target 128x40px (min 44x44)
- SMALL #btn-new — tap target 128x40px (min 44x44)
- HOLE  204x292px of nothing at (820,288) inside page — review
- HOLE  264x96px of nothing at (24,268) inside page — review
- HOLE  84x172px of nothing at (736,332) inside #activity — review

## tablet /board.html?fixed
- HOLE  296x96px of nothing at (24,272) inside page — review
- HOLE  248x88px of nothing at (752,216) inside page — review
- HOLE  216x88px of nothing at (180,12) inside page — review

## laptop /board.html
- SPILL span.title pokes 4px past #task-1 (right)
- SPILL span.title~6 pokes 4px past #task-6 (right)
- SMALL #btn-filter — tap target 128x40px (min 44x44)
- SMALL #btn-group — tap target 128x40px (min 44x44)
- SMALL #btn-export — tap target 128x40px (min 44x44)
- SMALL #btn-share — tap target 128x40px (min 44x44)
- SMALL #btn-new — tap target 128x40px (min 44x44)
- HOLE  316x292px of nothing at (1100,288) inside page — review
- HOLE  360x136px of nothing at (1056,52) inside page — review
- HOLE  564x84px of nothing at (180,12) inside page — review

## laptop /board.html?fixed
- HOLE  324x368px of nothing at (1092,292) inside page — review
- HOLE  540x136px of nothing at (552,524) inside page — review
- HOLE  632x88px of nothing at (180,12) inside page — review
