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
| where the content comes from | the seed, a migration, a spec document, a live database | **always ask.** Propose the source you found and how you found it; read nothing into slides until it is confirmed. See below |
| shows the app's screens | — | **always ask, yes or no.** A deck about software reads as a wall of text without them, and a deck for a reader who never sees the app may not want them. Ask once; a yes is not a list of screens, the slide plan proposes those |
| what it does not cover | the reader's request, and what you found and dropped | never |
| how long it is | your own draft plan | never — propose a number of slides |

## The slide plan

One row per slide: the number, the title, **what question it answers**, **where its
content comes from**, and **its picture** — the screen it shows as a drawn mockup
(`screens/<name>.svg`), or `—`. The picture is proposed, never asked slide by slide: the
reader sees every row and strikes or adds a screen in the same reply as the rest of the plan. It is the second half of `brief.md` and the thing `deck_check.py`
enforces — a slide absent from the plan, or a row whose source column is empty, fails.

Write the plan before the first slide. Then every slide has a job, and a slide that answers
no question is visible as a row with an empty middle column rather than as a wall of text
the reader has to read to discover it says nothing.

## The source is asked, every time

Not "asked if unsure" — **asked**. The session searches first and proposes, so the reader
confirms rather than researches, but the confirmation itself is never skipped:

> The numbers would come from `spec/mock/mock-data/*.json`, the seed this environment was
> built from — 18 states, 67 transitions, 5 checks. I found it because `seed:base` reads it
> and the running database matches it today.
> The alternative is the live database, which differs as soon as anybody uses the system.
> **Which should the deck describe?**

Three things make that a proposal and not a question: the source is **named**, how it was
found is **stated**, and the alternatives are **listed**. A session that cannot write those
three lines has not looked hard enough to be asking yet.

Record the answer in `brief.md` — the source per slide, and for the deck as a whole the
file or database it was read from **and when**. A deck is read months later; "the seed" is
not an answer then, and "the seed as of 2026-10-01, migration 097" is.

**A source the reader did not confirm never reaches a slide.** Not as a placeholder, not as
an illustration, not "for now" — once it is rendered it looks as finished as everything
around it.

## When there is more than one candidate

**Stop and ask which. Never pick the likelier one.** This is the rule that costs the most
when it is broken: a deck is believed, and a number taken from the wrong table is believed
too.

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
