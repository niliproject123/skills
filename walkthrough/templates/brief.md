# __NAME__ — walkthrough brief

Proposed by the session, filled from the repository and the scenario; corrected by the user in **one
reply**. Nothing is built before the "approved" line is filled. Each value says where it came from.

| | value | where it came from |
|---|---|---|
| command | `npm run walkthrough-__NAME__` | proposed |
| app address | __ADDRESS__ | __SOURCE__ (package.json / vite config / .env) |
| environment | __ENV__ (local · staging · production) | __SOURCE__ |
| writes to production | **no** — the walk refuses a production address unless this line says "yes, allowed by <name>" | default |
| scenario source | __SCENARIO__ (a document, a step list, an existing test) | the user |
| people | __PEOPLE__ (one by default) — name · username · password variable | seed / fixtures / the user |
| change of person | sign out and sign in on the app's own form, same window | default |
| data | __DATA__ — existing rows the walk reads, rows it creates | the scenario |
| seed | __SEED__ (`<command> --run {runId}`, or none — the walk uses existing data) | __SOURCE__ |
| cleanup | __CLEANUP__ — runs green or red; `WALK_KEEP_DATA=yes` keeps the data and says so | __SOURCE__ |
| run id | in every name the walk creates: `… {runId}` | default |
| strip language · direction | __LANG__ · __DIR__ (dictionary `walkthroughs/dictionary.__LANG__.json`) | `<html lang dir>`, the UI text |
| mode | stepped (a person presses Next) · auto (unattended) · both | default: both |
| screenshots / video | not part of a walk — a failed step is shot; for a film use the `scenario-video` skill | default |
| code goes to | `walkthroughs/` (runtime in `walkthroughs/walk/`) | proposed |
| reports go to | `walkthroughs/reports/<name>/<run id>/` | proposed |
| approved | *(name and date — nothing is built before this is filled)* | |

## What the code already gives (found, not asked)

| | found |
|---|---|
| stack · Playwright | __STACK__ — Playwright __PLAYWRIGHT__ (installed / to install) |
| sign-in | __SIGNIN__ (form test ids, what shows who is in) |
| how the app signals done · error · loading | __SIGNALS__ |
| seed / fixture mechanism to reuse | __FIXTURES__ |

## Test ids to add (on the elements the scenario touches)

| element | screen | proposed attribute | today |
|---|---|---|---|
| __ELEMENT__ | __SCREEN__ | `data-testid="__ID__"` | text only / none |

## The step list (approved separately, before any code)

| # | key | who | action (caption) | expected result | requirement |
|---|---|---|---|---|---|
| 1 | __KEY__ | __WHO__ | __ACTION__ | __EXPECTED__ | __REQ__ |

Steps the scenario takes for granted between two numbered ones are listed with `—` and run with them.

## Left out, and why

*(scenario lines the walk does not check, and the reason — so the next round does not re-open them)*
