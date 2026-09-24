---
name: scenario-video
description: Make guide videos of a web app from a Playwright browser run — a title card per step, a caption per action, a moving pointer, each person's recording cut down to their own actions, with .srt subtitles and a video log of what was kept and cut. Hebrew and other right-to-left languages are first-class. Use when the user asks for a guide video, walkthrough, tutorial or demo video of their web app, or wants to turn a user story or an existing Playwright test into a video.
---

# scenario-video — guide videos from browser tests

The goal is **a video**. A test (a Playwright scenario) is written only because a video needs one;
when the project already has a Playwright test for the story, hook into it instead of writing one.
This is not a test-fixing tool: when the scenario fails, report it and stop — a failed run makes no
video unless the user explicitly asks for `--accept-failed-run`.

Tools live in `scripts/` of this skill (TypeScript, Playwright, ffmpeg-static). They are copied into
the user's repository once, so the scenarios there can import them. Read
`references/` for the details each step points at.

## The flow — follow it in order

### 1. Settings (first use in a repository)

Look for `.claude/scenario-video.config.json` at the repository root.

- **Present:** read it, say in one line what it holds, and ask only if something this video needs
  is missing (a person, a seed).
- **Absent:** fill it yourself from the repository — `references/questionnaire.md` part A says
  where each answer is read from and which defaults apply. Write it from
  `templates/scenario-video.config.example.json` and show it as one table (value · where it came
  from) with the few questions the repo could not answer — usually none. The user corrects it in
  one reply. Field reference: `references/settings.md`. Passwords are never written into it — only
  the name of the environment variable holding each one.

The user's time goes into the video, not into setup: never ask what a file in the repository
already says.

### 1b. The app's code (first use)

Check `references/app-setup.md` against the code yourself (test ids on controls, rows and panels;
state to wait on; a token sign-in; a seed; reads and writes told apart). Report only what this
video needs and the app lacks, as one list with the proposed change for each, and ask once whether
to make them. A film is only as stable as these.

### 2. Tools in the repository (first use)

Copy this skill's `scripts/` (without `node_modules`) to the settings' `folders.tools`
(default `guide-videos/tools`), then `npm install` there. Report every error and warning of the
install verbatim. Playwright's Chromium must be present: if the self-check says it is missing, run
`npx --prefix <tools> playwright install chromium` and report its output. Then run
`npm --prefix <tools> run self-check` and report its result — every check must hold before a
recording. Suggest adding `<tools>/node_modules` and `<output folder>` to `.gitignore`.

### 3. The story → chapters, approved

Read the story — who does what, in which order, what the viewer should come away with — and write
**one proposal** (`references/questionnaire.md` part B) instead of asking questions: the kind (tour
or story), who watches, the films and people, the steps with their slide lines, **what each overlay
shows** (filled with this video's values — the user may add or remove items), the start data, what
is left out, the length. Chapters and notes: `references/plans-and-chapters.md`.

**Get explicit approval of the proposal before recording.** Chapters are words put in the product's
mouth. Record the approval in the plan's `chapterApproval` (who, date) — `make.ts` refuses to
record chapters without it. If the user wants something on screen the overlay cannot draw, say so
and propose the tools change; make it only once they agree.

### 4. Test data — a seed

The start data was part of the approved proposal. If the settings already name a seed command,
check it covers that. Otherwise help write one in the project's stack —
its api, its existing seed script with a flag, or its database client — from
`templates/seed.example.mjs` and `references/seeding.md`. Every row it creates carries the run id;
any failure exits non-zero. `make.ts` runs it before each recording with `{runId}` replaced and
`SCENARIO_RUN_ID` set.

### 5. The scenario, or the hook

- **New scenario:** `<scenarios folder>/<name>.scenario.ts` from `templates/example.scenario.ts`,
  following `references/writing-scenarios.md` — parts with `needs`, people opened through
  `openPerson`, every press through `person.press`, every wait on state (never a sleep), checks
  with `s.check`.
- **Existing Playwright test:** `references/hooking-existing-tests.md` — four small changes, and
  the plan runs it with `--workers=1`.

Then the plan: `<scenarios folder>/<name>.plan.ts` from `templates/example.plan.ts`.

### 6. Record and cut

The app must be running and answer its health check. The recording tools never start it; you may,
after asking:

1. Request the health check. If it answers 2xx, go on.
2. If not, tell the user it is not running and ask: "Start it with `<startCommand>`?" Also say if
   the port is already taken by another process (another session's server, say) — then ask what to
   do rather than start a second copy or stop the other one.
3. On yes: start it in the background, wait for the health check (not a fixed sleep), and report
   every error and warning in its output. If it does not come up, report its output and stop.
4. Leave it running after the recording and say so. Stop only a server you started, and only after
   asking.

Then:

```
npm --prefix <tools> run video -- <name>
```

It checks the plan, ffmpeg and the app's health check, seeds, runs the scenario with recording on,
and cuts. Output in `<output folder>/<nn>_<name>/` — see the outputs table in `README.md`.

### 7. Read the video log, adjust, re-cut

Read `video-log.md` and report to the user, per video: length, actions kept and cut, anything
**NOT MADE**, every problem while recording, and every caption flagged as reading like a developer
word. Adjust the plan (`leaveOut`, `keepAtMost`, `captionRules`) and re-cut without recording:

```
npm --prefix <tools> run video -- <name> --build-only <that folder>
```

A caption change or a chapter change is burnt into the recording — that needs a new recording.

To check how one moment looks after a change (a caption, a slide, the ring on a panel), record
**only that part** — `SCENARIO_PARTS=<part>` — never the whole film, and never by pulling frames
out of a full recording. Record the whole film once the parts look right.

## Rules that hold throughout

- Never call an error fine. A browser error, a recording problem, a failed check — report it.
- No silent fallbacks: every failure in the tools is a named error (`[code] message`); pass it on.
- Never use the Playwright MCP browser tools for this; the recording is made by the scripts.
- Do not push or deploy. Start or stop a server only after the user agrees (step 6).
- Hebrew / right to left: set `captions.language` and `captions.direction` — see
  `references/hebrew-rtl.md`. Title card, strip, subtitles and caption checks all follow it.
