# Orbit — 15 UI changes, checked at every phone size by script

Demo app: `board.html` (Board tab) and `board.html?tab=reports` (Reports tab), plus the New task dialog.
`app.css` is the app as delivered (bugs marked `BUG n`); `?fixed` adds `fixes.css`.
Run everything with `bash run-all.sh` (server on http://127.0.0.1:4517). Output: `out/mobile/before|after/screen-fit|modal-fit`.

## The 15 changes

| # | tab | change | delivered with a layout bug? |
|---|---|---|---|
| 1 | Board | Sprint summary card: name, days left, progress bar | no |
| 2 | Board | Three KPI tiles: Done / In progress / Blocked | yes — fixed 132px columns |
| 3 | Board | Search field with a Share button beside it | yes — fixed 250px search in a row that hides overflow |
| 4 | Board | Filter chips: All, Mine, Blocked, In review | yes — 30px tall |
| 5 | Board | Status pill on each task card | yes — title kept on one line runs under the pill |
| 6 | Board | Owner avatar on each card | no |
| 7 | Board | Two-column card grid from 600px wide | no |
| 8 | Board | "+ New task" button in the app bar | no |
| 9 | Dialog | New task dialog | yes — fixed 560px height |
| 10 | Dialog | Checklist inside the dialog | yes — 96px box that hides the rest |
| 11 | Reports | Velocity chart, last 6 sprints | no |
| 12 | Reports | "Export as CSV" button in the report header | yes — 70px wide button |
| 13 | Reports | Team workload table | yes — 600px minimum width |
| 14 | Reports | Blocked work panel | yes — held at 300px tall |
| 15 | both | Board / Reports tabs under the app bar | no |

## What the scripts reported

Copied from `out/mobile/before/screen-fit/screen-fit.md`, `before-modal-fit.log` and the after runs.
Viewports: phone 390x844, compact 667x360, phoneWide 749x346, tabletUp 768x1024 (screen-fit); 320x568, 360x640, 568x320, 667x375 (modal-fit).

| # | before (as delivered) | after (?fixed) |
|---|---|---|
| 1 | nothing | clean |
| 2 | EDGE: `#kpi-blocked` crosses right — phone. At compact, phoneWide, tabletUp the fixed columns leave a HOLE beside the tiles: 228x212, 312x212, 328x212 (shared with #3) | clean |
| 3 | CLIPPED: `#btn-share` cut off 20px by `#toolbar` — phone. Part of the HOLE above at the three wider sizes | clean |
| 4 | SMALL ×4: chips 46x30, 61x30, 79x30, 85x30 (min 44x44) — all four sizes | clean |
| 5 | OVERLAP: task 1 title × "In review" pill — phone 33x20px, compact 67x20px, phoneWide 37x20px, tabletUp 28x20px; task 3 title × "Blocked" pill — compact 16x20px | clean |
| 6 | nothing | clean |
| 7 | nothing | clean |
| 8 | nothing | clean |
| 9 | does not fit — 568x320: top 120px above, bottom 120px below, backdrop scrolls; 667x375: top 92px above, bottom 93px below, backdrop scrolls. Fits the screen at 320x568 and 360x640 | fits at all 4 |
| 10 | 88px hidden inside the card — all 4 sizes | 0px hidden, all 4 |
| 11 | nothing | clean |
| 12 | SPILL: label pokes 12px past `#btn-export` (left+right) — all four sizes | clean |
| 13 | SCROLLS SIDEWAYS: `#workload-scroll` by 276px — phone (fits from compact up) | clean |
| 14 | HOLE: 380x188 phone, 656x188 compact, 740x188 phoneWide, 760x188 tabletUp | clean |
| 15 | nothing | clean |

Totals: 9 of 15 changes carry a bug before. After: criterion 1 PASS on all 8 screen/size combos, 0 SMALL, 0 HOLE, 0 SCROLL, modal-fit 4/4 fit. No browser errors in any run.

## Per-screen marks (before)

| viewport | Board | Reports |
|---|---|---|
| phone | 7 (EDGE 1, OVERLAP 1, CLIPPED 1, SMALL 4) | 3 (SPILL 1, HOLE 1, SCROLL 1) |
| compact | 7 (OVERLAP 2, SMALL 4, HOLE 1) | 2 (SPILL 1, HOLE 1) |
| phoneWide | 6 (OVERLAP 1, SMALL 4, HOLE 1) | 2 (SPILL 1, HOLE 1) |
| tabletUp | 6 (OVERLAP 1, SMALL 4, HOLE 1) | 2 (SPILL 1, HOLE 1) |
