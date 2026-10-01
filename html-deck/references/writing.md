# Writing to a deck: deck_edit.py

## Writing to a deck: `deck_edit.py`

The line number `deck_text.py` prints is the write address too. Do not hand-anchor `sed`
on Hebrew strings that arrive with doubled spaces and `&nbsp;` -- address the line.

```
python <skill>/scripts/deck_edit.py <deck.html> --ops ops.json [--dry] [--renumber]
python <skill>/scripts/deck_edit.py <deck.html> --ops -        (ops json on stdin)
```

| op | does |
|---|---|
| `{"op":"set","at":"48","text":"..."}` | replace that element's content (escaped) |
| `{"op":"set","at":"48","html":"..."}` | same, keeping markup -- use to restore `<b>`/`<bdi>` |
| `{"op":"del","at":"51"}` | remove the element, and its line if nothing else is on it |
| `{"op":"after","at":"52","html":"<li>x</li>"}` | insert a sibling after it, at its indent |
| `{"op":"in","at":"47","html":"<li>x</li>"}` | append a child inside it |
| `{"op":"attr","at":"39","set":{"data-updated":"עודכן"}}` | add or rewrite attributes |

Add `"mark": true` to a `set` to also put `class="updated"` on it -- the green mark the
reader looks for. Mark the `<section>` with an `attr` op instead when you rebuilt a whole
slide.

**`at` is `<line>` or `<line>#N`.** `47#2` is the 2nd tag opening on line 47 -- these decks
pack `<div class="side"><h3>..</h3><ul>` onto one line. With no `#N` you get `#1` and a
note on stderr listing what else was on that line, so an ambiguous address announces
itself instead of silently hitting the wrong element.

**Every op resolves against the original file before anything is written**, so line
numbers never shift mid-batch -- read the slide once, write every change in one call.
This is the "match everything, then write" rule, enforced rather than remembered.

### What it refuses to write

The file is written only if all of these pass; otherwise it exits non-zero, says why, and
leaves the deck untouched:

- **every op resolved** -- one bad line number cancels the whole batch
- **every tag in the file balances** -- checked generically over every tag name present,
  not a hand-picked list. An unclosed `<li>` in inserted html is caught the same as a
  stray `<section>`
- **no editing chrome** -- `contenteditable`, `data-edit`, `data-orig`, `zoom:`
- **no bare mixed numbers** -- Hebrew followed by `20 / 26` is rejected with the RTL rule,
  since that renders as `26 / 20`. Wrap it in `<bdi dir="ltr">` and it passes
- **no overlapping edits** -- two ops on the same span is a mistake, not a merge

`--dry` prints the unified diff and writes nothing. Use it on the first run of any batch.

`--renumber` renumbers `data-no` and every `.slide-no` badge from the section order --
run it after adding or deleting a slide, which is the only time they can drift apart.

### Adding a whole slide

`after` on the previous `<section>` with the full `<section>...</section>` as `html`,
then `--renumber`. Take the markup from **Layouts** above -- pick the layout from the
shape of the content, and add nothing to `deck.css` without also adding it to `TARGETS`
in `edit.js`, or the reader cannot click that line.

### Picking up where the reader left off

The deck file holds the reader's edits, because saving writes over it. Before touching
anything:

```bash
python <skill>/scripts/deck_text.py <deck-folder> --edits   # every remark and deletion
git diff -- <deck-folder>                         # everything changed since last commit
```

Work through those before making changes of your own. `git diff` is the honest record
of what they rewrote — the deck itself no longer distinguishes their words from yours.
Commit a deck before handing it over, so the next diff is meaningful.

