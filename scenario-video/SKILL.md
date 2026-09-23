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
- **Absent:** run the questionnaire in `references/questionnaire.md` — ask the questions, in one
  message, grouped; propose an answer for each from what you can read in the repo (package.json
  scripts, a Playwright config, the login page, `data-testid` usage). Write the file from
  `templates/scenario-video.config.example.json`, show it, and let the user correct it. Field
  reference: `references/settings.md`. Passwords are never written into it — only the name of the
  environment variable holding each one.

### 2. Tools in the repository (first use)

Copy this skill's `scripts/` (without `node_modules`) to the settings' `folders.tools`
(default `guide-videos/tools`), then `npm install` there. Report every error and warning of the
install verbatim. Playwright's Chromium must be present: if the self-check says it is missing, run
`npx --prefix <tools> playwright install chromium` and report its output. Then run
`npm --prefix <tools> run self-check` and report its result — every check must hold before a
recording. Suggest adding `<tools>/node_modules` and `<output folder>` to `.gitignore`.

### 3. The story → chapters, approved

Ask for (or read) the story: who does what, in which order, what the viewer should come away with.
Propose:
- the **people** (from the settings) and whether it is one video per person or one film that follows
  the story across everybody (the settings' `videoShape` is the default);
- the **steps** — each becomes a title card, with its title in the caption language;
- optional **chapters** with side notes (one phrase each, ≤ 44 characters, shown on the strip) and
  card notes (longer, on the title card only) — `references/plans-and-chapters.md`.

**Show the proposed chapters and notes to the user and get explicit approval before recording.**
Chapters are words put in the product's mouth. Record the approval in the plan's `chapterApproval`
(who, date) — `make.ts` refuses to record chapters without it.

### 4. Test data — a seed

Ask what data the story needs to start from (accounts, a record in a given state). If the settings
already name a seed command, check it covers that. Otherwise help write one in the project's stack —
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

The app must be running (the settings' `startCommand`; the tools never start it). Then:

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

## Rules that hold throughout

- Never call an error fine. A browser error, a recording problem, a failed check — report it.
- No silent fallbacks: every failure in the tools is a named error (`[code] message`); pass it on.
- Never use the Playwright MCP browser tools for this; the recording is made by the scripts.
- Do not push, deploy or start/stop the user's servers unless asked.
- Hebrew / right to left: set `captions.language` and `captions.direction` — see
  `references/hebrew-rtl.md`. Title card, strip, subtitles and caption checks all follow it.
