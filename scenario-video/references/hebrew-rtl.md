# Hebrew and right-to-left

Right to left is a first-class case here, not a translation afterthought. The self-check runs
entirely in Hebrew, on an RTL page, and proves each point below.

## Set it
```json
"captions": { "language": "he", "direction": "rtl" }
```
`he` has built-in words (`לוחצים על ״…״`, `ממלאים את ״…״`, `משתתפים: `). Arabic, Persian and other
languages set `direction: "rtl"` and bring `captions.words`. The browser locale follows the language.

## What follows the direction
| where | what happens |
|---|---|
| title card | laid out right to left; a long Hebrew heading wraps and is stepped down from 54px until the card fits (checked with a full-sentence heading, and with one eight times longer) |
| strip | right to left; each side note one line, cut with an ellipsis rather than wrapped |
| pointer | placed at the centre of the control's box, wherever RTL layout put it (checked on a control at the right-hand edge) |
| captions | Hebrew quote marks ״…״; the caption uses the control's own visible Hebrew words when the scenario pressed by test id |
| subtitles (.srt) | each line wrapped in a right-to-left embedding (U+202B … U+202C), so players keep the closing quote and full stop at the correct end |
| video log | Hebrew step titles and captions in the tables; a caption with no Hebrew, or with a Latin-only quoted part, is flagged as not translated |
| cut rules | `leaveOut` / `keepAtMost` / `steps` are regular expressions over the Hebrew words, e.g. `{ what: /^סגירה$/ }` |

## Things to know
- Name steps and people in Hebrew in the scenario (`title: 'דנה מזמינה חבר צוות'`,
  `openPerson('דנה')`) — those are the words on screen.
- Side notes are measured in characters (44); Hebrew is usually shorter than English for the same
  phrase, but a note with a long number or email is not.
- Mixed Hebrew and Latin in one caption (a product name) renders correctly on the card and the
  strip; in the .srt, the embedding keeps the line's base direction right to left.
