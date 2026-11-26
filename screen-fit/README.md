# screen-fit

Deterministic layout grading of a page that is actually running. Point it at a
dev server; it opens every route at every viewport, measures each element with
`getBoundingClientRect`, and grades the geometry in Node. No screenshots to
squint at — a PASS/FAIL per criterion and one line per hit, naming the element
and how many pixels are wrong.

Copied from `c:/dev/backgammon/main/tests` and made app-neutral. The analyzers
are unchanged; everything app-specific in the runner is now an env var.

## Run it

```bash
cd c:/dev/skills/screen-fit/scripts
npm install          # first time only

WEB_URL=http://localhost:5173 npx tsx screen-fit.ts
```

Exit code is `0` when criterion 1 passes, `1` when it fails, `2` when the run
was void (see below). The report is written to `screen-fit-report/screen-fit.md`
beside the script, with a screenshot per viewport × route, and printed to
stdout.

### Settings

| env | default | what it does |
|---|---|---|
| `WEB_URL` | `http://localhost:5173` | origin of the running app |
| `ROUTES` | `/` | comma-separated paths to open |
| `VIEWPORTS` | `tablet,laptop,big` | from `phone, phoneWide, compact, tabletUp, tablet, ipad, laptop, big` |
| `OPAQUE` | `svg,canvas` | selectors NOT to look inside — see below |
| `SEED_STORAGE` | `{}` | JSON written to localStorage before the first route |
| `EMPTY_BAND` | `10-15` | criterion 2 pass band, in % of screen; `off` to skip |
| `MIN_BUTTON_PCT` | `10` | criterion 3 floor, in % of the viewport's short side; `off` to skip |
| `OUT_DIR` | beside the script | cwd-relative; point it at a discussion folder |
| `HEADLESS` | `true` | `false` to watch it work |
| `SEED_SESSION_STORAGE` | `{}` | as `SEED_STORAGE`, into sessionStorage. Applied through `addInitScript`, before any page script — an app that reads its session at boot has already decided it is signed out by the time an `evaluate` could seed it |
| `AFTER_LOAD_CLICKS` | – | selectors clicked after a route loads, before it is graded. See *Reaching screens that have no URL* |
| `FULL_PAGE` | `false` | `true` grades the whole document instead of the first screenful. See *The fold* |
| `HOLE_MIN_SIDE` | `80` | shortest side, in px, a rectangle of nothing must have to be reported; `off` to skip |

## What it checks

**Criterion 1 — nothing crosses nothing.** The hard gate, no knob, four checks:

- **`clip`** — an interactive element cut off by a container that *hides* its
  overflow, so it cannot be scrolled into view. It is simply gone. Scroll
  containers are exempt: content you can reach is not lost.
- **`spill`** — content whose real box pokes out past the card or button holding
  it. A coin wider than its tile, an image over a card edge.
- **`edge`** — an element crossing the edge of the viewport.
- **`overlap`** — two elements in normal flow sitting on top of each other.

Overlaps where one element is absolutely placed are reported separately as
`overlay?` and do **not** fail the run — no automated check can tell a designed
badge-on-an-avatar from a mistake, so those are for a human to read.

**`HOLE` — a rectangle of nothing inside the content.** Reported, never gated,
like `overlay?`. The empty % cannot see one: it is a ratio over the whole page,
so a band of nothing under a table and the same pixels spread thinly between
that table's rows score identically. Holes are measured inside the *content's*
bounding box, so the page's own margins are never reported. The three largest
are listed, each with the smallest container that holds it.

It was added after a two-block admin panel was found with a 224px band of
nothing under its second table: `analyzeEmptiness` already computed a
per-container figure that would have shown it, and the reporter had always read
only `emptiness.page.emptyPct` and thrown the rest away.

**`SCROLL` — an element whose own content does not fit inside it**, so it
carries a scrollbar. Reported, never gated: a list column that scrolls is the
design, and a form card that scrolls is usually not. Only axes whose computed
overflow is `auto` or `scroll` count — `overflow: hidden` also reports
`scrollWidth` past `clientWidth`, but that is a cell truncating with an ellipsis
and keeping its value in the `title`, which is deliberate; content genuinely
lost that way is what `clip` is for. Without that filter the real hits drown:
34 lines on one admin panel, 33 of them ellipses.

Nothing in the probe read `scrollWidth` or `scrollHeight` before this, which is
why a form card scrolling 25px sideways at every viewport was never reported.
`clip` exempts scrollable ancestors on purpose, and a ratio of empty space
cannot see a scrollbar.

**Criterion 2 — empty space**, against a band. **Criterion 3 — buttons hold
their share of the viewport**, so they do not shrink into nothing on a big
screen, with a 44px tap-target floor on top.

Both of those are taste, and the defaults came from a game that fills its
screen. A diagram viewer is legitimately mostly empty and a toolbar of icon
buttons is legitimately small; left at the defaults such an app reports FAIL
forever and the report stops being read. Retune them or switch them off.

## Two things that will waste your time

**Git Bash rewrites a route that starts with `/`.** `ROUTES='/#/s/16'` arrives as
`C:/Program Files (x86)/Git/#/s/16` and every navigation fails, so the run is
`VOID` — which is at least loud, but the cause is not obvious. Export
`MSYS_NO_PATHCONV=1` (and `MSYS2_ARG_CONV_EXCL='*'`) first, or run it from
PowerShell.


**Set `OPAQUE` for the app.** Anything that draws its own shapes — a chart, a
game board, an icon set — overlaps itself by design. Left out of the list, every
node and every line in it reports as an overlap and the real hits drown. For the
Cochart viewer:

```bash
OPAQUE='.diagram-surface svg,svg,canvas'
```

**A run that measured nothing prints `VOID`, never PASS.** If a route failed to
navigate, or an extraction returned zero elements, the script says so and exits
`2`. Do not read a verdict out of a void run. Browser errors — page errors,
console errors, failed requests, any HTTP >= 400 — are collected and printed
under "NOT ignorable"; they do not fail the run on their own, but they are never
swallowed.

## The fold

**By default the probe grades the first screenful and nothing else.** Extraction
drops any element whose top is past `window.innerHeight` — `screen-fit.ts`,
the line commented `// offscreen`. On a page taller than the viewport that is
most of the page: a second block starting at y=971 on a 900px-tall viewport is
never measured at all, and the report says PASS about a screen it did not look at.

`FULL_PAGE=true` sets the canvas to the document's own scroll height instead, so
everything is measured and the screenshot is `fullPage`. `edge` then means
"crosses the document's edge" rather than "crosses the fold", which is why it is
not the default — every existing run keeps the meaning it has always had.
Criterion 3 stays on the real viewport either way: a button is small or not
against the screen a person is looking at.

It is worth a run. On one admin panel it took the graded element count from 226
to 394 and turned up two bands of nothing that four earlier runs had passed over.

## Reaching screens that have no URL

A modal, a second step in a flow, a tab panel — plain navigation never gets
there, so they are not graded. `AFTER_LOAD_CLICKS` is the app-neutral way in: a
comma-separated list of selectors clicked in order after the route loads and
before the geometry is read.

```bash
ROUTES='/#/s/16' AFTER_LOAD_CLICKS='[data-admin-panel-tab="states"]' npx tsx screen-fit.ts
```

A selector that never becomes clickable is reported as a browser error and that
route is skipped — never a quietly ungraded route that reads as a pass. For an
overlay, measure it with `modal-fit.ts` in `../layout-probes` instead: it asks
whether the card fits, which is a different question from whether the page
collides.

## Worked example — the Cochart viewer

```bash
cd c:/dev/skills/screen-fit/scripts
WEB_URL=http://127.0.0.1:2911 \
ROUTES=/web/index.html \
VIEWPORTS=laptop,tablet,phone \
OPAQUE='.diagram-surface svg,svg,canvas' \
EMPTY_BAND=off MIN_BUTTON_PCT=off \
npx tsx screen-fit.ts
```

found, on 2026-08-26:

```
| viewport | route            | elements | edge | overlap | spill | clip | c1   |
| laptop   | /web/index.html  | 48       | 0    | 0       | 0     | 0    | PASS |
| tablet   | /web/index.html  | 31       | 0    | 0       | 0     | 1    | FAIL |
| phone    | /web/index.html  | 23       | 0    | 0       | 0     | 1    | FAIL |

- CLIP  button cut off 6px by app-shell (right)
- CLIP  #session-select cut off 107px by app-shell (right)
```

The topbar runs out of room below laptop width and the session picker is cut
off — a real bug, found without anyone looking at a screenshot.

## Changes from the original

- Import path fixed; the analyzers sit beside the runner now.
- **`detectClipped` is wired in.** It was written, exported, and never called —
  the original probe extracted the data for it and threw it away, so nothing
  graded the one thing that analyzer was written for.
- The final verdict counts clipped too. It counted three of the four checks, so
  it could print "CRITERION 1 PASS" above a table with FAIL rows in it.
- A `__name` identity shim is installed in the page. esbuild may compile a named
  arrow inside an evaluate body into `__name(fn, "fn")`, which does not exist in
  the page — the body then dies with `ReferenceError` and nothing is measured.
- App-specific bits are env vars: the opaque list, the localStorage seeding, the
  routes, the output folder, the criterion 2 and 3 thresholds.
- Portrait viewports added; the original set was landscape-only.
- **`position: sticky` counts as positioned**, with `absolute` and `fixed`. A stuck bar keeps its
  slot in the flow, so without this a designed bottom bar reads as a hard collision with every row
  it is pinned over — seventeen of them on one admin screen, drowning the real hits.
- `AFTER_LOAD_CLICKS` and `SEED_SESSION_STORAGE`, above. Both are no-ops when unset.
- **`analyzeHoles`** and the `HOLE` lines, above. The per-container emptiness the
  analyzer had always computed was never read by the reporter; this is the part
  of it that names a defect.
- **`FULL_PAGE`**, above. Without it the probe never sees a page below its fold.
- **`SCROLL`**, above. A card that does not fit itself was invisible to all four
  of criterion 1's checks.

## The duplicate copy

`../layout-probes/screen-fit.ts` is a second copy of this script, byte-identical until 2026-09-02.
The three changes above went in here, beside this README; that copy is now behind. `modal-fit.ts`
in that folder is a different tool and has no twin.
