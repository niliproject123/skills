# Reading a deck: deck_text.py and deck_views.py

## Reading a deck: `deck_text.py`

**Never read a deck's HTML to find out what is on it.** A deck is 1000+ lines of markup
whose classes are one letter long -- `grep 'class="t"'` returns 71 hits with no slide
attached, and one line can hold three separate fields. `scripts/deck_text.py` dumps the
deck as flat text, one row per text node, with the file line number as the edit anchor:

```
python <skill>/scripts/deck_text.py <deck.html|deck-folder> [--slide 07] [--edits] [--json]
```

```
=== 02 מי מחליט ומה המערכת עושה לבד  flow.html
    41  title           | מי מחליט, ומה המערכת עושה לבד
    47  side teal>h3    | אדם מחליט — שינוי מצב ידני
    48  side teal>li    | לקלוט תיק, או לא לקלוט אותו
```

Leading column is the marker: `!` a `michael:` remark, `-` a line the reader emptied
(`data-cut`), `+` marked `updated`, blank for ordinary text.

| Want | Call |
|---|---|
| the map -- every slide, its name, its size, where it starts | `--toc` (~38 lines for both decks) |
| one slide's full content, ready to edit | `--slide 07` |
| everything the reader touched, both decks | `--edits` -- replaces the two greps below |
| to locate wording anywhere | `--find "regex"` -- see below. Do not pipe the dump to `grep`: a bare hit tells you the words but not what the slide was saying |
| to edit from a script | `--json` -- rows of `{deck, slide, line, path, text, mark}` |

The path column is the last two classed ancestors, so it says what a row *is*
(`facts>k`, `qlist>q`, `mini>td`) -- enough to rebuild a slide without opening the HTML.
Deck chrome (`#deckbar`, `#bar`, `.slide-no`, `.rule`) is dropped; `<bdi>`, `<b>` and
`.tag` fold into their parent row rather than fragmenting it.

**The line number is the anchor.** `--slide 07` then `sed -n '238,270p'` on the named
file gets you the markup for exactly that slide -- two calls, no search.

### Finding a topic across the deck: `--find`

```
python <skill>/scripts/deck_text.py <deck-folder> --find "קובץ|קבצים" [--ctx 2] [--json]
```

Groups every match by slide and prints it **in context**: the slide's own `title` and
`kicker` first, wherever they sit, then each matching row with `--ctx` rows either side.
Matches are marked `>`, skipped stretches show as `...`, and the tail counts matches and
slides. `--json` adds `"hit": true/false` per row for scripted work.

The title and kicker are pulled in on purpose. A grep hit gives you a sentence with no
idea which slide is talking or what it was arguing; the slide's own heading is what makes
the hit answerable, and it is nearly free.

## What a screen LOOKS like: `deck_views.py`

`deck_text.py` dumps a slide's prose, which is the right shape for its fields and its
rules and the wrong shape for its mockup. A mockup is a table of five columns, a tree
four levels deep, a form of eight fields -- flatten that to text and the structure is
gone, and the next session has to reopen the HTML to get it back.

```
python <skill>/scripts/deck_views.py <deck.html|deck-folder> [--slide 09] [--html] [--json]
```

```
=== 09  מסך 6 — יועצים   [table]
    [טבלה] שורה לכל מקצוע; שורת הכותרת היא השדות
    880  טבלת היועצים           טבלה (+סרגל)     5 עמודות · 4 שורות · 5 פעולות
```

| Want | Call |
|---|---|
| every screen and the kind of view it is | no flag |
| one screen's mockups | `--slide 09` |
| **the markup of those mockups**, to rebuild or reuse them | `--html` |
| the same as data | `--json` -- adds `view`, `also`, `size`, `framed`, and `html` with `--html` |

**The kind is read from the markup, never from the wording**, so it cannot drift from
what the slide renders: a `table.mini` is a `table`, a `.tree` is a `tree`, a `.rail` is
a `rail`. `.chips`, `.facts` and `.note` are *decoration* -- an action strip sits under
nearly every mockup, so counting it as a view would report every screen as a סרגל and
say nothing. A block with only decoration in it reports as that decoration and never
speaks for the whole slide.

Three screens draw their view straight onto the slide with no `.mock` frame -- slide 13
is a bare `.rail`, 15 a `.two`, 19 a `.rules`. Those are views too; the report marks them
`~` and a mock-only reader would have called those slides empty.

### Every screen states its own view

Two marks, written into the file:

| | |
|---|---|
| `data-view="table"` on the `<section>` | the machine key -- one of `table kpis tree form board rail cards people two rules` |
| `<p class="viewkind">` under the kicker | `<span class="vk">` the pill, `<span class="vt">` the sentence the reader can rewrite |
| `data-view="טבלה"` on a `.mock-t` | the pill on that one mockup's header |

The mockup pill is drawn by CSS from the attribute (`.mock-t[data-view]::after`), so it
adds no text node: nothing new to edit by accident, and `deck_text.py`'s output is
unchanged. Only `.viewkind .vt` is editable, and it is in `TARGETS`.

A mockup pill names **that mockup**, which is often not the slide's headline view -- a
filter strip above a card list is a סרגל on a `cards` screen. That is the point of having
both.

The report says `NO data-view` for a slide that frames a mockup and never states its
kind, and `MISMATCH` when the declared kind matches nothing the slide actually holds.
A question list or an appendix has a shape but not a view, and is not nagged.

