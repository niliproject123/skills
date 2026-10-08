# The deck skeleton, the window fit, and the layout catalogue

## Deck skeleton

```html
<!doctype html>
<html lang="he" dir="rtl">          <!-- drop dir="rtl" for LTR decks -->
<head>
<meta charset="utf-8">
<title>Deck name</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/_deck/deck.css">
<link rel="stylesheet" href="/_deck/edit.css">
</head>
<body class="has-deckbar">

<div id="deckbar">
  <span class="name">Deck name</span>
  <a class="here" href="flow.html">התהליך</a>
  <a href="screens.html">המסכים</a>
</div>

<section class="slide" data-no="01" data-name="שער">
  <div class="slide-no">01</div>
  ...
</section>

<div id="drawer"></div>
<div id="bar">
  <span>שינויים: <span class="count" id="cnt">0</span></span>
  <span>הערות: <span class="notes" id="notes">0</span></span>
  <button id="btn-list">מה שיניתי</button>
  <button id="btn-save" class="go">שמור</button>
  <button id="btn-clr">בטל שינויים</button>
  <div class="spacer"></div>
  <span id="status">טוען…</span>
</div>
<script src="/_deck/edit.js"></script>
<script src="/_deck/fit.js"></script>
</body>
</html>
```

`data-no` and `data-name` are required on every slide — remark ids are built from them.

### Fitting the window

The slide frame is a fixed `1280x720`. On its own that means a narrower window — or a
browser zoomed in — cuts the slide off at the side and pushes it past the bottom of the
screen. `fit.js` scales the deck with `zoom` to whatever the window can show, so a
standard slide is fully visible at any size and any zoom level. **One factor for the
whole deck**, taken from the `1280x720` frame -- not per slide. Scaling each slide to
its own height makes a `.slide.grow` narrower than the slides around it, which reads as
a broken deck; a grow slide keeps the common width and scrolls instead. It refits on
resize and on browser zoom.

The scale is a measurement of *this* window, so it must never reach the file: `cleanHTML`
in `edit.js` strips `zoom` from every slide in the clone, and `'zoom:'` is in the save's
leak list — a scale that slipped through cancels the save instead of being written.
`zoom` is used rather than `transform: scale()` because it changes the layout box, so no
empty space is left behind, and the caret in a `contenteditable` line stays where it looks.


## Layouts

All defined in `scripts/deck.css`. Compose freely; they are plain classes.

**Pick the layout from the shape of the content, not from habit.** A deck where every
slide is the same grid of boxes reads as a wall and gets the note *"unreadable, too long,
too vague"* — which is exactly what happened here. The reader should be able to tell what
kind of thing a slide holds before reading a word of it.

The frame, on every slide:

| Class | Use |
|---|---|
| `.slide` | the 1280×720 frame. Add `.grow` if content must exceed it |
| `.slide.cover` | title slide, dark gradient; `h1` + `.sub` + `.strip` + `.foot` |
| `h1.title` + `.rule` + `p.kicker` | the standard head of a content slide |
| `.note`, `.note.warn` | one callout under the content — at most one per slide |
| `p.viewkind` > `.vk` + `.vt` | on a screen slide: the kind of view it is, in one phrase |
| `.tag.set/.open/.ask` | inline status badge |
| `.sect` / `.sect.later` | labelled band above a group ("now" vs "later") |
| `.index-grid` > `a` > `.n` + `.t` | clickable slide index |

Then one of these, chosen by what the slide actually is:

| Content shape | Layout |
|---|---|
| **a screen** — what it holds, and what it looks like | `.screen` > `.facts` + `.mock`. `.wide-spec` flips the ratio, `.even` splits it |
| a field and its meaning | `.facts` > `.g` (group heading) + `.f` > `.k` + `.v`, or `.b` for a loose sentence |
| a miniature of the real screen | `.mock` > `.mock-t` (`.mt` + `.cap`) + `.mock-b` |
| **a drawn mockup** — a chart, a dark theme, a dialog over a graph | `.screen.drawn` (`.phone` for a tall one) > `.facts` + `div` > `img.mock-img` (`.tall`) + `.mock-cap`. See *Drawn mockups* below |
| numbered callouts on a mockup | `.facts .f .k` > `span.n` — the same number as the mockup's badge |
| rows of a list inside a mockup | `table.mini` — header row is the **fields**, body rows are the **examples** |
| filters or states above a list | `.chips` > `.chip.on/.ok/.bad/.warn/.off` |
| a derived folder tree | `.tree` > `.l1`…`.l4` — indentation carries nesting, never arrows |
| a form | `.form` > `.fld` (`.w2` spans) > `.lb` + `.in` |
| N independent rules | `.rules` (`.c1`/`.c3`, `.later` greys it) > `.r` > `.n` + `.h` + `.d` |
| an ordered sequence of states | `.rail` (`.c5`, `.exec` blue) > `.st` (`.ask`) > `.n` + `.h` + `.d` |
| two sides of one boundary | `.two` (`.mid` adds a `.divider`) > `.side.teal/.blue` > `h3` + `ul>li` |
| open questions | `.qlist` (`.c2`) > `.q` (`.settled`) > `.n` + `.t` + `.a` |
| real tabular data | `table.grid`; `td.num` for figures |
| a grid of short cards | `.cards.c2….c5` > `.card` (`.accent`/`.teal`/`.flag`) > `.h` + `.d`. `.tight` shrinks it |
| counters at the top of a dashboard | `.kpis.c3….c5` > `.kpi` (`.ok`/`.warn`/`.bad`) > `.n` (the figure) + `.t` (what it counts) + `.s` (its breakdown) |

`.cols`/`.panel`, `.steps`/`.step`, `.trio`, `.blocks` are older primitives, still styled
and still fine — `.two`, `.rail` and `.facts` supersede them in new work.

Palette is in `:root` — `--navy --blue --teal --red --yellow --purple --line`.
Use the variables, never raw hex, so a deck restyles in one place.

Anything you add here must also be added to `TARGETS` in `edit.js`, or the reader
cannot click that line and rewrite it.


## Drawn mockups

Only when the brief says the deck shows the app's screens, and only on the slides its plan
gives a picture. When markup cannot look like the screen — a chart, the app's own dark theme,
a dialog over a graph — draw the screen as svg instead. The deck folder gets `build_screens.py` (copy
`templates/build_screens.py`); it imports the primitives from `scripts/screen_mock.py` and
writes `screens/*.svg`, one function per screen, named for the screen.

What makes a drawn mockup trustworthy, and what this deck format checks for:

- **read, never recall.** Every label is a string found in the app's code, every colour comes
  from its theme file, and the layout from its components. Name the files in the builder's
  docstring and in `brief.md`. A real screenshot, when one exists, is the thing to compare against
- **no user data.** `bar()` stands where the app shows a name, a date or a number; `wave()`
  draws the shape of a line, not anybody's prices. Example rows with invented tickers or
  amounts are invented data, and the brief's source rule applies to them
- **say it is a drawing.** `.mock-cap` under each picture: *mockup drawn from the app's code ·
  grey bars stand for your own data*
- **callouts sit on empty space.** `marked(..., at=)` puts the badge on the side of its ring
  that has room; a corner badge covers the first word of what it marks
- **look before the reader does.** `screen_mock.py preview <deck-folder>` renders every svg
  headless to `.preview/*.png` and refuses one that does not parse — a browser shows a
  broken svg as an empty frame, and the slide just looks sparse. Then `deck_check.py` for fit

```html
<div class="screen drawn">
  <div class="facts">
    <div class="f"><div class="k"><span class="n">1</span>Show</div><div class="v">...</div></div>
  </div>
  <div><img class="mock-img" src="screens/graph.svg" alt="graph screen">
    <div class="mock-cap">mockup drawn from the app's code · grey bars stand for your own data</div></div>
</div>
```
