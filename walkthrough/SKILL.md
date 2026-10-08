---
name: walkthrough
description: Turn a web app scenario into a guided, browser-driven walkthrough test — a Playwright run that walks the scenario one step at a time on one page, with a strip over the app saying before each step who acts and what should happen, a red ring on the control about to be touched, "Next" to run it, its result and checks after it, a start-step choice, an automatic mode with pause, back navigation, and a report with PASS / FAIL / NOT CHECKED per requirement. Use it when someone wants a guided or stepped walkthrough test of a web app scenario, a step-by-step demo-test with an overlay, a manual-assisted e2e walk, "walk me through the scenario in the browser", or wants a scenario document turned into a test a person can watch and drive. Hebrew and other right-to-left strips are supported.
---

# walkthrough — a scenario walked in the browser, one step at a time

A walkthrough is a test a person can watch and drive. The scenario's steps run in a real browser on one
page; before each step the strip says who acts and what should happen, the ring stands on the control
the step will touch, and the step runs when "Next" is pressed. After it the strip shows the result. The
same code runs unattended (`WALK_MODE=auto`); the exit code is the result either way.

A film of a scenario is the sibling skill `scenario-video` (`c:\dev\skills\scenario-video`): use it for
guide videos, screenshots cut into films, title cards and subtitles. This skill does not record.

## The flow — in order

1. **Find out from the code** what it already answers: the stack and whether Playwright is there, how
   elements are identified, the routes and the signals each step can wait on, the sign-in, existing seed
   and fixture mechanisms. `references/discovery.md`.
2. **Propose one brief** (`templates/brief.md`), filled, with where each value came from — app and
   environment (production writes refused unless the user allows them in writing), scenario source,
   people (one by default), data and cleanup, strip language and direction, mode, where code and reports
   go and the command name — plus the test ids to add and **the step list**. The user corrects it in
   one reply. Do not interview. `references/brief.md`.
3. **Build** after approval: copy `templates/walk/` to `walkthroughs/walk/` and the chosen dictionary,
   write `<name>.steps.ts` and `<name>.walk.ts` from the examples, add the agreed test ids and the npm
   script, typecheck. If Playwright must be installed, report every install error and warning verbatim.
   `references/building.md`.
4. **One run**, then **the report** read from `walk-report.md`: per step its result, failed and NOT
   CHECKED checks with reasons, browser errors, time and scroll. Ask before starting the app; stop only
   what you started.

## Rules that hold throughout

- Every touch through `step.act`; every wait on state, never a sleep; every race names its endings.
- Every check is named after its requirement; NOT CHECKED always carries a reason and is never a pass.
- Never call an error fine — a browser error, a failed check, a failed cleanup is reported as one.
- No fallbacks: a missing setting, word, password, seed or test id stops the walk with a named error.
- All strip text comes from the dictionary file; direction is a config setting. No words in code.
- Back and Return here navigate only; nothing on the strip writes to the app.
- The run id is in everything the walk creates; the cleanup runs green or red.
- Never use the Playwright MCP browser tools for this; the walk drives its own browser.

## What is here

| path | what |
|---|---|
| `references/discovery.md` | what to read from the code before asking anything |
| `references/brief.md` | the one proposal, its defaults, the step list |
| `references/building.md` | file split, step shape, controls, running, output, delivery order |
| `references/mechanisms.md` | every mechanism, why it exists, and the bug it prevents |
| `templates/walk/` | the runtime: `overlay` · `controls` · `runner` · `harness` · `checks` · `outcomes` · `scroll-meter` · `dictionary` · `types` |
| `templates/example.steps.ts` · `example.walk.ts` | a three-step, two-person example: the steps file and the entry file |
| `templates/dictionary.he.json` · `dictionary.en.json` | the strip's words |
| `templates/brief.md` | the brief to fill |
| `scripts/check-templates.mjs` | typecheck the templates: `node scripts/check-templates.mjs <node_modules with playwright, typescript, @types/node>` |

The templates typecheck; they cannot be proven against a given app until the first run there.
