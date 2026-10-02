---
name: html-deck
description: Build a slide deck as a plain HTML file the reader opens in a browser, edits in place, and gets back as a pptx or a pdf — one section per slide, a side list of slides and a contents page built from the deck itself, content generated from a named source rather than typed, and a check that every slide fits its frame before it is sent. Use it whenever someone wants slides, a deck, a presentation, a מצגת, a customer-facing summary of how something is configured, or wants an existing deck updated, reordered, reviewed or exported.
---

# html-deck — decks you can see while you write them

A deck is a plain HTML file: one `<section class="slide">` per slide, linking shared CSS and
JS from this skill. No build step, no bundler, no framework.

Why not author in pptx: you cannot see a pptx while you write it, so every layout defect
ships blind — and pptx shapes cannot express these layouts in the first place. An HTML deck
renders in a browser, so **you verify before the reader does**, and the reader rewrites a
line by clicking it rather than by sending you a list.

The pptx and the pdf are **exports** of a deck you already checked. That is a different
thing from authoring one blind, and it can be checked too.

## Where this skill lives

One copy, at `c:\dev\skills\html-deck`, in git. Each machine reaches it through a directory
junction, which needs no administrator:

```
mklink /J "%USERPROFILE%\.claude\skills\html-deck" "C:\dev\skills\html-deck"
```

That one link makes it available in every project on the machine. **Never copy the scripts
into a project** — a copy is a fork that drifts, and the CSS and JS are served out of this
folder to every deck at `/_deck/`. What belongs to a project is the project's own decks and
its own conventions, in that project's own skill.

## A deck is a folder

```
<folder>/
  brief.md             who reads it, what it is for, and one row per slide naming where
                       that slide's content comes from. Agreed before any slide is written
  <deck>.html          the slides
  build_slide_data.py  reads the source the brief names, writes data.json and fragments/
  data.json            what the builder produced
  fragments/           generated blocks the slides include
  changes.json         the reader's remarks, paired with the marks in the deck
  .bak/                what the editor saved over, newest last
```

Nothing on a slide is a number somebody typed. When the source changes, the builder runs
again and the deck is current — that is the whole reason the folder has a builder in it.

## The flow, in order

### 1. The brief — before any slide

Propose it, do not interview. Fill every line you can from the repository, show it as one
table, and get it corrected in one reply. `references/brief.md` says what to fill from where.

**Four things are always asked**, because no file answers them and a wrong guess rewrites
the deck:

- **where the content comes from** — name the file, table or document you intend to read
  and say how you found it, then get it confirmed **before reading any of it into slides**.
  Finding one plausible source is not permission to use it
- **who reads it** — it sets every word on every slide
- **how it will be read** — on screen, printed to pdf, sent as pptx, projected
- **right-to-left or left-to-right** — never inferred from the language of the request

Two rules follow from the first, and cost more than all the rest together:

- **where two sources could have produced a number, stop and ask which.** Never pick the
  likelier one, and never the one that makes the slide tidier
- **a source the reader did not confirm never reaches a slide** — not as a placeholder, not
  as an illustration, not "for now". The deck goes out and nobody remembers which it was

### 2. The folder

```
python <skill>/scripts/deck_new.py <folder> --title "..." --direction rtl --language he
```

`--direction` is required and has no default, so a deck cannot be scaffolded by a session
that never asked. It writes the skeleton, `brief.md`, `changes.json` and the builder stub,
and refuses to overwrite a folder that already holds a deck.

### 3. The data

Point `build_slide_data.py` at the source the brief names, and have it write `data.json`
plus `fragments/*.html`. One small function per block, named for what it returns — never
`slide_07`, because slides get reordered and the name then lies.

A deck written from a document rather than from data skips this: `deck_new.py --no-builder`.
A deck written from a markdown document that is mostly tables can be converted in one step
with `scripts/md_table.py`.

### 4. The slides

Pick the layout from the shape of the content, not from habit — `references/layouts.md` has
the catalogue and the skeleton. A deck where every slide is the same grid of boxes reads as
a wall.

### 5. The navigation

```
python <skill>/scripts/deck_nav.py <deck-folder>
```

Writes **both** the side list of slides and the contents block, from one scan of the
`<section>` elements, so they cannot disagree with each other or with the deck. Both sit
between markers, so a rerun replaces exactly what the last run wrote; running it twice
changes nothing. Never write either by hand — a contents list goes stale the moment a slide
is renamed, and then the reader clicks 7 and lands on 8.

Run it after adding, deleting, renaming or reordering a slide, together with
`deck_edit.py --renumber`, which stamps `data-no` and the corner badges.

### 6. The check — before anyone outside the room sees it

```
python <skill>/scripts/deck_check.py <deck-folder> --url http://127.0.0.1:8899
```

Four checks, each one a defect that actually shipped. Exit code is the result.

| | |
|---|---|
| `fit` | **every slide fits 1280×720.** Measured in a headless browser at zoom 1, because only a browser knows how tall Hebrew wraps |
| `nav` | the sidebar and the contents match the slides |
| `marks` | `data-no`, the corner badge and the ids agree; no contents link is dead |
| `brief` | every slide has a row in `brief.md`, and every row names its source |

**A slide that overflows is clipped, not scrolled** — `overflow:hidden` on the frame means
it looks finished on screen while its last rows are gone, and it reaches the pdf and the
pptx the same way. `.grow` fails the check too: a slide taller than the frame cannot be one
pptx slide or one pdf page. Split it, or shrink it, or declare the deck screen-only with
`--allow-grow`.

### 7. The reader

Serve the folder, hand over the URL, and let them edit in the page. The loop — remarks,
green marks, `changes.json`, picking up where they left off — is `references/the-reader.md`.

### 8. The export

`references/pptx-and-print.md`. The print stylesheet is in `deck.css`, so printing to pdf
needs nothing per deck: one slide per page, at its own size, in its own colours.

## The scripts

All under `<skill>/scripts/`. Shared CSS and JS are served from there too — never copied
into a deck folder.

| | |
|---|---|
| `deck_new.py` | start a deck folder |
| `serve.py` · `servers.py` | serve a folder; find the viewer that already exists |
| `deck_text.py` | **read a deck as text** — never read the raw HTML to find out what is on it |
| `deck_views.py` | what each screen slide *looks* like: table, tree, form, board |
| `deck_edit.py` | write to a deck by line number; refuses an unbalanced or marked-up file |
| `deck_nav.py` | the sidebar and the contents, from one scan |
| `deck_check.py` | fit · nav · marks · brief, before it is sent |
| `reorder_slides.py` | put the slides in the order written in `slide-order.txt` |
| `md_table.py` | a markdown document of tables becomes a deck |
| `to_pptx.py` | a picture per slide — identical to the deck, not editable |
| `to_pptx_native.py` | native shapes and tables — editable in PowerPoint |

## Rules

- **Do not open a browser to look at your work.** Playwright runs its own profile and cannot
  attach to the reader's window, so every check launches a second browser nobody asked for.
  Verify from the shell: `curl` the served bytes, `deck_text.py --slide NN` to read it back.
  `deck_check.py` and `to_pptx.py` are the exceptions and barely are — their headless
  Chromium *is* the work, it shoots or measures and closes, and it never touches the
  reader's window.
- **One viewer per deck folder.** Run `servers.py` the first time you touch a folder, before
  serving, before editing, before quoting a URL — the point is to find the viewer that
  already exists and share it. Never route around a busy port by choosing another one.
  `references/serving.md` says why, and what an orphan looks like.
- **Plan the tool calls before making any.** A deck is hundreds of lines of HTML you cannot
  hold in context. Write down what you need to know and fetch it in one or two calls.
- **Match everything, then write.** Resolve every anchor and count first; write no file
  until all of them pass. `deck_edit.py` enforces this rather than trusting you to remember.
- Only the changed lines go in a script. Generating a list? Loop over data — do not type out
  markup that differs by three words per row.
- One `<section>` per slide, in order. Keep a single deck file under 600 lines; split into
  two decks instead.
- **Never say a slide is fine when the check failed.** Report the overflow in pixels and the
  slide it is on.

## References

| | |
|---|---|
| `references/brief.md` | what to ask, what to read, and the source rule |
| `references/layouts.md` | the skeleton, the window fit, the whole layout catalogue |
| `references/reading.md` | `deck_text.py` and `deck_views.py` in full |
| `references/writing.md` | `deck_edit.py`: the ops, and what it refuses |
| `references/the-reader.md` | remarks, marks, `changes.json`, the archive of what was cut |
| `references/serving.md` | serving, and the one-viewer rule in full |
| `references/rtl.md` | right-to-left: `<bdi>`, numbers, svg text anchors |
| `references/pptx-and-print.md` | both exports, printing, and checking the result |
| `references/layers.md` | the layered deck format |
