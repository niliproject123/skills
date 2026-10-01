# The reader: remarks, marks, changes.json, and what was cut

## How the reader responds

There is no comment system. **Every line of text on a slide is editable in place** —
`edit.js` assigns ids at load and turns each leaf text node into a `contenteditable`
field, so new slides need no extra markup. The reader clicks a line and rewrites it.

Pressing save posts the whole document back; the server writes it **over the deck's
own file**. The file is therefore always the current state — reading the deck is
reading the feedback, and there is no side store to fall out of sync.

The reader has **two** ways to say something, and only one of them involves typing a
marker. **`deck_text.py --edits` surfaces both**, and must be run at the start of every
session.

**A remark they typed.** Written inline, prefixed `michael:` or `מיכאל:` — the code
matches either language. Highlighted yellow on screen.

```bash
python <skill>/scripts/deck_text.py <deck-folder> --edits    # "!" rows
```

Answer each one, then delete the marker text from the line as you resolve it — an
unanswered remark must stay in the file.

**A line they emptied.** Deleting the text *is* the instruction: it means take this out.
Requiring a marker on top of that is make-work, so `edit.js` records the deletion itself.
The removed wording is kept in a `data-cut` attribute on the element and shown struck
through in red, so the slide still reads, the reader can put it back, and you can find it:

```bash
python <skill>/scripts/deck_text.py <deck-folder> --edits    # "-" rows
```

Resolve one by **removing the element entirely** — not by leaving an empty box behind,
and never by restoring the struck-through text. If removing it would break the layout
(a table column, one cell of a grid), say so and ask rather than silently keeping it.
`data-cut` survives the save on purpose; it is content, not editing chrome, so the leak
guard lets it through and `cleanHTML` leaves it alone.

**Work the whole batch in one pass.** Grep out every remark first, read them together,
then apply them in a single sweep. Round trips dominate the cost here, not the editing:
thirteen remarks answered together cost a fraction of two remarks answered seven times.
If a remark cannot be resolved without the reader, do every other one and put that single
question to them at the end — never stop the batch on it.

**Two things that cost whole round trips, both avoidable.**

- **Match on normalised text, not raw bytes.** Deck text arrives with trailing spaces,
  doubled spaces and `&nbsp;`. Collapse whitespace on both sides before comparing, assert
  the anchor appears exactly once, and collect the misses into one report rather than
  aborting on the first.
- **`export PYTHONIOENCODING=utf-8` on every python invocation.** The Windows console is
  cp1252, so a single Hebrew `print` kills the script — and it dies *after* the edits and
  *before* the write, so the work is silently lost.

**What the save writes.** The editing chrome (`data-edit`, `data-orig`,
`contenteditable`, undo buttons, runtime highlight classes) is injected at load and
stripped before saving, so it never accumulates in the file. The save aborts loudly
if any of it survives the strip rather than writing a polluted deck.

### Showing the reader what you changed

They cannot find your edits in a deck they have already read. Mark them, in the file
itself — not injected at load, so the marks survive a reload and a handover.

| | |
|---|---|
| a slide you rebuilt or moved | `data-updated="עודכן"` on the `<section>` — green corner chip |
| a single line you rewrote | `class="... updated"` on the element — green dashed outline |

Green is yours, purple is theirs; the two never collide. `edit.js` counts the marks and
puts **`‹ עודכן: N ›`** in the bar, with **`נקרא`** beside it. The arrows walk the marks
in both directions; `נקרא` strips every mark and saves, so the deck goes back to plain
once they have looked. Mark the slide, not each of its cards, when you rebuilt the whole
slide.

**Both trails are walkable, and clickable.** A second cluster, **`‹ דילוג להערות ›`**,
walks the reader's own remarks the same way — every line carrying a `michael:` marker or
emptied to ask for a deletion. That list is rebuilt on each press rather than cached,
because unlike the green marks it changes while the page is open. And clicking anything
marked — a green update or a yellow remark — opens the card that says what it is: for an
update, the `ביקשת` / `היה` record from `changes.json`; for a remark, the remark and the
wording it replaced. The click is never swallowed, so the line still takes the caret and
stays editable.

Every button `edit.js` injects carries `data-chrome`, and `cleanHTML` sweeps that
attribute. Add a button without it and the save aborts on its own leak guard rather than
writing the toolbar into the deck.

### The mark says *that* something changed. `changes.json` says *why*

A green mark on its own is a diff with no argument: the reader sees your new
sentence and has no idea which of their remarks produced it. The drawer renders
**ביקשת** (their request) then **היה** (the old wording) above the new text, and it
reads both out of `changes.json` beside the deck.

**Write it in the same pass as the marks, never afterwards.** One entry per mark, in
**document order** -- `edit.js` pairs mark *i* with entry *i* positionally, there is no
id linking them:

```json
{"screens.html": [
  {"ask": "כתבת: חתימות הם רק לאנשים מורשים", "was": "בינתיים הנחנו שלא"},
  {"removed": true, "slide": "24 · השאלות", "ask": "תסיר את זה",
   "was": "<the line you deleted>", "note": "<what you did>"}
]}
```

`removed` entries are for lines you took out — they have no element left to mark, so
they are listed on their own and are **excluded from the count**. Everything else must
line up exactly: `edit.js` compares the number of non-removed entries against the number
of marks, and on any mismatch it **throws the whole record away** and flashes
*רשומת השינויים אינה תואמת את הסימונים*. The drawer then shows your new text with no
ביקשת and no היה — which looks like the feature was never built.

Count before you write, and fail loudly rather than shipping a mismatch:

```python
marks = len(re.findall(r'class="[^"]*updated', html)) +         len(re.findall(r'data-updated=', html))
```

When you cut a remark's line out of the deck, the `removed` entry is the **only** record
that the exchange happened. Skip it and the reader has no way to see what they asked.

**Two consequences to keep in mind.**

- An edited line becomes plain text, so inline `<b>` and `<span class="tag">` inside
  *that line* are lost. Untouched lines keep their markup. Restore emphasis by hand
  when you process the edits.
- A generated deck is overwritten by its builder. **Before rebuilding, grep the deck
  for `michael:` and carry the edits back into the source**, or they are destroyed.
  The server keeps the last 20 versions of each deck in `<deck-folder>/.bak/`, which
  is the recovery path if that goes wrong.

### The archive of what was cut

When content is dropped from a deck rather than changed, it goes to a `stage2` folder
beside the deck folder, as `stage2.<original name>`. `serve.py` mounts that folder at
`/stage2/`, serving `.html` and `changes.json` only, with no traversal. It is **saved
back exactly like a live deck**: `edit.js` sends the folder as part of the document name
(`stage2/stage2.flow.html`), `deck_path` accepts that one prefix and nothing else, and
backups land in `stage2/.bak/`. What was cut still has to be judged and corrected, so it
cannot be frozen. Link it from the deckbar with `<a class="arch" href="/stage2/<name>.html">`,
and give the folder its own `changes.json` -- the editor fetches it relative to the deck,
and a missing one raises a warning banner on load. Markdown in the archive is not served;
it is read from disk.

