# The brief — one proposal, corrected in one reply

Do not interview the user question by question. Read the repository and the scenario, fill
`templates/brief.md`, and show it as one message: the table with where each value came from, the test
ids to add, the step list, and the few questions nothing answered. End with: "Correct anything that is
wrong, and say which test ids to add." This is the house style of the `scenario-video` skill
(`c:\dev\skills\scenario-video\references\questionnaire.md`).

## What the brief asks, and the defaults

| item | default | ask when |
|---|---|---|
| app address and environment | from `package.json` scripts, the dev-server config, `.env*` | nothing names it |
| production writes | **refused**. A walk writes. Production is allowed only when the user writes it in the brief, by name. Put the production address in `productionAddresses` either way, so a mistyped `WALK_APP_ADDRESS` is refused | never assumed |
| scenario source | a document or a step list: per step the action, the expected result, who acts | always shown back as the step list |
| people | **one actor**. Several only when the scenario has several roles | the scenario names roles and no seed names accounts |
| change of person | sign out and sign in on the app's own form, in the same window — the watcher sees whose screen it is | the app has no sign-out |
| data | existing rows the walk reads, rows it creates, how they are found (the run id in their names), cleanup | the scenario needs a state no seed makes |
| strip language and direction | from `<html lang dir>` and the UI's own text; `dictionary.he.json` + `rtl`, or `dictionary.en.json` + `ltr`; any other language is a copy of one, translated | the UI's language is mixed |
| mode | both: stepped for a person, auto for an unattended run | — |
| screenshots and recording | not part of the walk (a failed step is shot). A film is the `scenario-video` skill | the user asks for a video |
| where code and reports go, the command | `walkthroughs/`, `walkthroughs/reports/`, `npm run walkthrough-<name>` | the repo has a test folder convention — follow it |

Passwords never go into a file: each person names an environment variable (`DANA_PASSWORD`), and the
brief ends with the instruction to set them.

## The step list

The step list is approved **before any code**. One row per step: number, key, who, the action (one
line — the strip's caption), the expected result (what the step checks), the requirement it proves.
Number the steps as the scenario numbers them; a press the scenario takes for granted between two of
them is a row with `—`. Numbers rise in walk order — a step that runs before its number is a numbering
bug (the runner refuses it).

Write captions and descriptions in the scenario's own words and the strip's language. The description
is what the strip reads out before the step: what happens and what should be seen.

## When the user corrects it

Update the brief file, keep the "where it came from" column honest (the user's correction is a source),
and fill "approved" with the name and date before writing code.
