# Writing a scenario

A scenario is a standalone `npx tsx` program: one `runScenario({...})` call, and **the exit code is
the result** — 0 only when no check failed and no browser error was seen. It runs as a plain test
when started directly, and as a recording when `make.ts` starts it. Template:
`templates/example.scenario.ts`.

## Header
Every scenario opens with a comment saying: purpose, the people, **what the seed provides** (and,
if anything is stood in for, exactly what), the env vars, and how to run it.

## Shape
- **Parts** — `{ key, title, subtitle?, needs, run }`. `title` is what the viewer reads on the
  title card and what the plan matches. `needs: []` means the part starts from the seed; a part that
  relies on what another left behind names it. `SCENARIO_PARTS=a,b` runs those and their needs;
  `SCENARIO_PARTS=sign-in` runs the startup only (proves seed and sign-in).
- **People** — `s.openPerson('Dana')` in `startUp`: a browser context of their own, signed in the
  way the settings say, named on their video. A second page for the same person:
  `s.openPerson('Dana', 'on her phone')` — the plan's `who: 'Dana'` still takes it.

## Touching controls — always through the person
`press`, `fill`, `choose` check the control is visible **and** enabled, put away the app's
dismissible overlays (declare them in `dismissibleOverlays`), name whatever still covers the
control, then draw the pointer and caption, then act. Targets, most to least robust:
`'test-id'` · `{ role, name }` · `{ label }` · `{ text }` · a Locator. A click done any other way is
filmed but gets no caption and no pointer.

The caption comes from the control's own visible words when the target is a test id or selector;
pass `what` (third argument) when the words on screen are not what the viewer should read.

## Waiting — on state, never on sleep
`person.waitFor(target)` for one outcome; `s.race(what, [{ name, wait }], ceilingMs)` when a step
can end more than one way — every ending is named, and the ceiling is itself a named ending, so the
run always says why it stopped. A fixed wait needs a comment saying why. The recorder's own pauses
(3s title card, 0.9s pointer, 0.5s field caption) exist for the viewer and are the only exceptions.

## Checks
`s.check(what, condition, detail?)` and `s.same(what, actual, expected)` record
`PASS` / `ASSERT FAILED: what (expected X, got Y)`, never throw, and fail the exit code. A thrown
error ends the run (`FATAL`), and the rest of the parts do not run.

## What the runtime watches
- **Four browser listeners** on every page, before its first navigation: console errors, uncaught
  errors, failed requests, 4xx/5xx from the app's addresses. Zero allowed: the first buys one
  reload of that page, the next ends the run.
- **Watchdog**: a sample of the page each second; 30 identical samples (`stallTicks`) is a stall,
  and the run ends as `scenario.stalled` with the last samples printed.
- **Report**: `scenario-report.md` in the recording folder — failed checks, every browser error,
  parts ran / skipped / not reached, the watchdog's samples.

## Watching without pressing
`person.watch(caption, holdMs, async () => { … })` for something that must be seen — a report
scrolling, an animation. The cut keeps `holdMs` of it instead of the usual two seconds.
