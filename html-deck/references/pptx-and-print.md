# Exporting: pptx, and printing to pdf

## Exporting to pptx

Some readers want a `.pptx`. `scripts/to_pptx.py` makes one that looks like the deck,
by shooting every slide in Chromium and putting one picture on each 16:9 pptx slide.

```
python <skill>/scripts/to_pptx.py <deck-folder> <out.pptx> \
    --decks flow.html,screens.html --shots <temp-dir> --sheet <check.png>
```

Needs `playwright` (`pip install playwright`, then `playwright install chromium` if
no Chromium is cached), `python-pptx`, and `pillow` for `--sheet`. The deck server must
already be running too -- the decks link `/_deck/deck.css`, which only resolves over
http. The script refuses to run without it and prints the serve command rather than
exporting a deck with no stylesheet.

`--decks` sets the slide order; without it every `.html` in the folder is used, sorted
by name, which is rarely the order you want. Keep `--shots` outside the deck folder --
the server would serve the PNGs and git would see them.

**The text is not editable in PowerPoint, and that is the trade.** A pptx built from
native shapes cannot reproduce `.rail`, `.facts`, `.mock` or a `table.mini`, and you
cannot see what you built to check it -- which is the reason this skill exists. If the
reader needs to edit text, they edit the deck, and you export again.

### One file per deck, named in the deck's own language

A reader opening `flow.pptx` and `screens.pptx` gets two decks they can send on
separately, which is usually what they want -- run the script once per deck with a
single `--decks` name. One combined file only makes sense when the decks are read
end to end in one sitting.

The presentation title is taken from that deck's `<title>` unless `--title` overrides
it, so a Hebrew deck arrives with a Hebrew title in PowerPoint's title bar and in
Explorer's Title column. Name the file to match; the title tag is the name the reader
already knows the deck by.

### fit.js is undone before the shot

`fit.js` zooms every `.slide` to fill the reader's window. Left alone at a 1440-wide
viewport it makes a 1280x720 slide measure 1396x785, so **every** slide reads as
"taller than 720" and gets shrunk to fit -- a whole deck exported a few percent small
for no reason. `CAPTURE_CSS` sets `.slide{zoom:1!important}`, which beats the inline
style fit.js writes. If the tall-slide list ever names every slide in the deck, this
is what broke.

### Keep the card

A slide in the browser is a white card -- `1px solid var(--line)`, 6px corners, a
`0 2px 14px` shadow -- sitting on `#E9EDF2` paper. An export that strips that to go
edge to edge is flatter than the deck the reader approved, and it shows. `--frame`
decides how much of the card survives:

| | |
|---|---|
| `all` (default) | every slide is the card, on paper. Costs ~3% of the width |
| `fitted` | only slides that outgrew 720px are carded, the rest go edge to edge |
| `none` | edge to edge everywhere -- flattest, biggest text |

The card is captured, not drawn: the JS wraps each `<section>` in a padded div and
shoots that, so the border, the corners and the real shadow all come from `deck.css`.
Nothing in the pptx re-implements the styling, which is why it cannot drift from the
deck. The pptx slide background is set to the same `#E9EDF2`, so the paper is seamless.

### Slides that outgrew 720px

A `.grow` slide is fitted by *height* and centred: nothing is cropped, but it sits
smaller with paper either side. Those slides are shot one device-pixel-ratio step
sharper than the rest, since they are the ones being scaled down -- without that their
text goes soft exactly where it is already smallest.

The run lists each one and the share of the slide width it ended up using. Under ~70%
the body text is too small to project: trim that slide to 720px in the HTML, or split
it in two. Do not fix it by cropping.

### Checking the export without PowerPoint

`--sheet` writes a contact sheet by reading **only from inside the .pptx**: the stored
background colour, the embedded image, its stored geometry. Since each slide is one
picture on a solid fill, that is what a viewer paints -- so a bad font, a clipped
slide, a flattened card or a wrong order all show up here. Look at it before handing
the file over.

It is not proof that PowerPoint opens the file. Nothing on this machine can be. Say so
when you hand the pptx over, and ask the reader to open it once.


---

## Printing is part of the skill now, not of each deck

`deck.css` carries the print stylesheet, so a deck needs nothing of its own to print well:

- one slide per page, `@page` at 1280×720, chrome and sidebar dropped
- `zoom` forced back to 1, so the reader's window scale never reaches the paper
- `print-color-adjust: exact`, without which Chrome drops every background and border and a
  chart prints as grey text with its bars gone

A deck that still needs its own rules puts them in a `deck-extra.css` beside it and links it
after `/_deck/deck.css`. **Never in a `<style>` block inside the deck**: `edit.js` cancels a
save when the file contains `zoom:` or `data-chrome`, and print rules need both words — the
reader loses their edits to a dialog nobody can act on.

## Every slide fits, and a script says so

```
python <skill>/scripts/deck_check.py <deck-folder> --url http://127.0.0.1:8899
```

A slide taller than the frame is **clipped, not scrolled** — `overflow:hidden` means it looks
finished on screen while its last rows are gone, and it reaches the pdf and the pptx exactly
that way. The check measures every slide in a headless browser at zoom 1 and reports the
overflow in pixels.

`.grow` fails it too. A grow slide is one pptx slide that is not 16:9 and one pdf page that
is not a page. Three ways out, in order of preference: split the slide, cut content, or — for
a deck that will only ever be read on a screen — say `--allow-grow` and record that in
`brief.md` under *how it will be read*.
