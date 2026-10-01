# Asking the reader what goes in the deck

The reader answers **two messages**: one approving the brief, one approving the slide plan —
and usually those are the same message. Everything the repository can answer is read, not
asked. A question is asked only where no file holds the answer and no default is safe.

A deck that skips this is the deck that gets rewritten twice: once because it was aimed at
the wrong audience, once because a number came from the wrong table.

---

## The brief, proposed and not asked

Fill every line you can from the repository, then show the whole thing as a table for
correction. `brief.md` in the deck folder is where it lives, and `deck_check.py` reads it.

| line | fill it from | ask when |
|---|---|---|
| what the deck is for | the reader's own request | never |
| who reads it | — | **always ask.** It sets every word on every slide. A customer, a team, a regulator and a new joiner need four different decks from the same data |
| how it will be read | — | **always ask.** On screen · printed to pdf · sent as pptx · projected. It decides whether a `.grow` slide is allowed at all, and whether charts may stay as svg |
| language and direction | `<html lang dir>` of an existing deck, the repository's own text | **always confirm rtl or ltr.** Never infer it from the language of the request. It decides the sidebar's side, how every mixed number must be wrapped, and whether the pptx needs `rtl="1"` on each paragraph |
| where the content comes from | the seed, a migration, a spec document, a live database | **two candidates exist** — see below |
| what it does not cover | the reader's request, and what you found and dropped | never |
| how long it is | your own draft plan | never — propose a number of slides |

## The slide plan

One row per slide: the number, the title, **what question it answers**, and **where its
content comes from**. It is the second half of `brief.md` and the thing `deck_check.py`
enforces — a slide absent from the plan, or a row whose source column is empty, fails.

Write the plan before the first slide. Then every slide has a job, and a slide that answers
no question is visible as a row with an empty middle column rather than as a wall of text
the reader has to read to discover it says nothing.

## The source rule

**Where two sources could have produced a number, stop and ask which. Never pick the
likelier one.** This is the single rule that costs the most when it is broken: a deck is
believed, and a number taken from the wrong table is believed too.

In practice:

- a count that appears in both a seed file and the live database — ask which one the deck
  is describing, because they differ the moment anybody uses the system
- a name that exists in a catalogue and in a requirement list with different wording — show
  both and ask which the reader's audience uses
- anything the repository marks as invented test data — never put it on a slide

Say where a number came from **on the slide** when the audience could reasonably wonder, and
in `brief.md` always.

## What is still asked while building

Three things, and nothing else:

1. a source with two candidates, as above
2. a slide that will not fit — offer the split rather than shrinking the type
3. wording the data cannot settle: a label the audience uses that the schema does not

Everything else is proposed, shown, and corrected in the browser, where the reader is
already editing lines.
