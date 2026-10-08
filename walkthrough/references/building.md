# Building the walk

## Delivery order

1. **The brief and the step list**, approved in one reply (`brief.md`). No code before it.
2. **The code**: copy the runtime, write the steps file and the entry file, add the test ids the user
   agreed to, add the npm script. Typecheck.
3. **One run** — stepped if the user is watching, otherwise `WALK_MODE=auto`. Ask before starting the
   app or a server; stop only what you started, after asking.
4. **The report**: per step its result, failed and NOT CHECKED checks with their reasons, browser
   errors, scroll and time — from `walk-report.md`, not from memory. Every error is reported as an
   error; none is called fine, expected or flaky.

## The files

Copy `templates/walk/` into the repository as `walkthroughs/walk/` (once per repository; a later walk
reuses it), and the dictionary the brief chose to `walkthroughs/`. Then per walk:

| file | from | what |
|---|---|---|
| `walkthroughs/walk/overlay.ts` | template | the page script: strip, ring, fade, fold, steps list |
| `walkthroughs/walk/controls.ts` | template | touching a control (ring · gate · hold · act), the wait for Next, Back / Return here |
| `walkthroughs/walk/runner.ts` | template | start step, before / after / change of person, gated run, the report rows |
| `walkthroughs/walk/harness.ts` | template | settings and refusals, seed, browser, the four listeners, log, cleanup |
| `walkthroughs/walk/checks.ts` | template | PASS / FAIL / NOT CHECKED and the report file |
| `walkthroughs/walk/outcomes.ts` · `scroll-meter.ts` · `dictionary.ts` · `types.ts` | template | races, scroll per step, words, shapes |
| `walkthroughs/<name>.steps.ts` | `example.steps.ts` | the approved step list as code |
| `walkthroughs/<name>.walk.ts` | `example.walk.ts` | config, the app's sign-in hooks, `runWalk` |
| `walkthroughs/<name>.brief.md` | `brief.md` | the approved brief |

Each file stays under 600 lines. A walk with many steps splits its steps file by section
(`<name>.opening.ts`, `<name>.closing.ts`) and the entry file concatenates the sections.

`package.json`: `"walkthrough-<name>": "tsx walkthroughs/<name>.walk.ts"`. Typecheck the copied files
with the project's `tsc`; this skill's own check is `node scripts/check-templates.mjs <node_modules>`.

## A step

```ts
{
  number: 2, key: 'send-invite', actor: 'dana', expects: ['R2', 'R3'],
  caption: 'Dana invites Omer',                       // one line: the strip's title
  description: 'Dana presses Invite, types …',        // the scenario's words: what happens, what is seen
  run: async (step, world) => { … },
}
```

Inside `run`:

- **Every touch through `step.act`** — `press`, `fill`, `choose`, `tick`, `untick`, `upload`, `point`.
  Each one waits until visible, scrolls the section then the control into view, rings it, (gates the
  step's first touch on Next), holds, checks it is enabled, acts. A click done any other way is not
  ringed, not gated, not recorded for Back, and a watcher cannot follow it.
- **Wait on state, never on sleep**: `locator.waitFor`, `page.waitForFunction` on an attribute, a URL.
  When a step can end more than one way, `step.race` with named outcomes and a ceiling, each long wait
  through `untilRaceEnds` so the losers stop with the race. A fixed wait carries a comment saying why.
- **Scope reads to this action**: read the result inside the panel, row or dialog this step opened,
  matched by what it names — never "the first toast on the page".
- **Checks named after the requirement**: `step.checks.check('R2', 'the invitation is pending', ok,
  { expected, received })`, `step.checks.same(...)`, and `step.checks.notChecked('R3', name, reason)`
  when the case the check needs did not come up here. Never turn a check you could not make into a
  PASS, and never drop it silently.
- **Time the app, not the person**: start a clock after a touch returns (or after `act.point`), never
  before a step's first touch, which waits for Next.
- **Shared state** goes on `world` (an id step 2 created, read by step 5) — the start step runs earlier
  steps for real, so `world` is filled the same way whichever step the person starts from.
- A step that throws ends the walk after showing its error. Throw a `WalkError(code, message)` when a
  precondition fails — a named error, not a vague timeout.

## Controls the person has

| control | what it does | never |
|---|---|---|
| Next | runs the step (after the ring stands on its first control), or goes on after a result | — |
| Continue automatically | first press turns into "Press again to confirm" for 3 s; a second press answers every Next until Pause | switches on a single press |
| Pause / mode | always on the strip: on auto the Pause button, step by step the mode ("waiting for Next") | hidden in either mode |
| Back · Return here | while Next waits: earlier ringed controls and back; navigation, unfolding, ring only | writes, presses, signs out |
| Steps | the steps list, current step marked, any time; chosen from only at the start | jumps |
| ▾ / tab | folds the strip to a tab; the walk still waits, and the tab says so | — |

The strip's title says which wait it is: "Before step N/M", "After step N/M — done ✓ / failed", or
"Change of user: sign out and sign in as <name>". M is counted from the numbered steps, never typed.

## Running

```
npm run walkthrough-<name>                              stepped: choose the start step on the page
WALK_START_STEP=5 npm run walkthrough-<name>            stepped from step 5; steps 1–4 run by themselves
WALK_MODE=auto npm run walkthrough-<name>               unattended, window visible
WALK_MODE=auto WALK_HEADLESS=yes npm run walkthrough-<name>   unattended, no window
```

Also: `WALK_RUN_ID`, `WALK_KEEP_DATA=yes`, `WALK_APP_ADDRESS`, and each person's password variable. A
value that is not one of these refuses to start, by name. A stepped walk never runs headless.

## Output

In `<reportFolder>/<name>/<run id>/`:

| file | what |
|---|---|
| `walk.log` | every line stamped `[+12.345s] [actor] message`: touches, checks, waits for Next, races, scroll, browser errors, seed and cleanup output |
| `walk-report.md` | result and exit code; one row per step (result, acting time, waiting time, scroll px and screens, check counts); every check with requirement, status, expected, received, reason; requirements a step named and no check proved; browser errors; notes |
| `step N <key> — failed.png` · `stopped.png` | the page when a step failed, and when the walk stopped |

The exit code is the result: 0 only when every step ran, no check failed, no browser error was seen
and the cleanup succeeded. NOT CHECKED does not fail the run and is always listed with its reason.

## Data and cleanup

The run id goes into every name the walk creates and into the seed and cleanup commands (`{runId}`).
The cleanup runs after the walk, **green or red**; a cleanup that fails fails the run.
`WALK_KEEP_DATA=yes` keeps the data and writes the command that would remove it into the report.
