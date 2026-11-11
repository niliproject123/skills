# סימונים על תמונות — the brief

The contract for this deck. Written as a proposal by the session, corrected by the reader in
one reply, and **approved before any slide is written**. `deck_check.py` reads the slide plan
below: a slide missing from it, or a row with no source, fails the check.

| | |
|---|---|
| what this deck is for | show the new picture features of html-deck: full screen on click, boxes and arrows with labels, clearing |
| who reads it | Michael, who uses html-deck daily and asked for the features |
| how it will be read | on screen, and exported to pptx (picture and editable) and pdf to check the drawings survive |
| language and direction | he / rtl |
| where the content comes from | html-deck/scripts/draw.js, lightbox.js, deck_draw.py in this repo |
| shows the app's screens | yes — made-up example screens (build_screens.py), drawn only to have something to draw on |
| confirmed by the reader on | 2026-11-10 (features agreed in chat; the deck shows no numbers) |
| read from it on | 2026-11-10, main at ae02c82 plus the uncommitted drawings work |
| what it does **not** cover | moving or resizing a drawing after it is made, colours other than red |
| approved by | waiting for Michael — this deck is the example he approves before the push |

## The slide plan

One row per slide. The source column is the load-bearing one: it names the file, table or
document each slide's content is read from. Where two sources could have produced a number,
the session stops and asks which — it never picks the likelier one.

The picture column is a proposal: the screen a slide shows as a drawn mockup
(`screens/<name>.svg`), or `—` for none. It stays `—` on every row when the reader said no to
screens.

| # | slide | what it answers | where its content comes from | picture |
|---|---|---|---|---|
| 01 | שער | what this is, and for whom | — | — |
| 02 | מסך מלא | how a picture opens full screen | lightbox.js | screens/dashboard.svg |
| 03 | סימונים מוכנים | drawings written by deck_draw.py | deck_draw.py | screens/dashboard.svg |
| 04 | תמונת טלפון | drawings on a png and a tall picture, and clearing | draw.js | screens/phone.png |

## What is left out, and why

Drawing straight on the slide (without opening full screen) was left out: a click on a picture opens full screen, so one click could not mean both.
