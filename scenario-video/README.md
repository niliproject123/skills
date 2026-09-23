# scenario-video — guide videos from browser tests

A Claude Code skill that turns a user story about a web app into **guide videos**: a real browser
run of the app, recorded per person, with a title card at each step, a caption for each action and
a pointer that moves to the control about to be pressed — then cut down to each person's actions,
without the waiting, with `.srt` subtitles and a log of everything kept and cut.

It writes a Playwright scenario only because a video needs one. If the project already has a
Playwright test for the story, it hooks into that test instead.

**Hebrew and right-to-left languages are first-class** — see [Hebrew and RTL](#hebrew-and-right-to-left).

## Install

Copy (or clone) the `scenario-video/` folder into your skills folder:

```
~/.claude/skills/scenario-video/        (for every project)
<repo>/.claude/skills/scenario-video/   (for one project)
```

Needs Node.js 20+. On first use in a repository the skill copies `scripts/` into the repository
(default `guide-videos/tools/`), runs `npm install` there (Playwright 1.62.1, ffmpeg-static,
tsx) and the self-check. If Chromium for that Playwright version is missing:
`npx --prefix guide-videos/tools playwright install chromium`.

## First-run questionnaire

The first time, Claude asks — and saves the answers to `.claude/scenario-video.config.json`, reused
by every later video:

- how to start the app, its address, its health check;
- how a user signs in (a UI form, an api token written into storage, or none) and which accounts
  (passwords stay in environment variables, never in the file);
- the seed command — or help writing one;
- whether controls carry a `data-testid`-like attribute (otherwise role/text locators, with a warning);
- where scenarios, tools and videos go;
- caption language and direction;
- one video per person, or one film per scenario, and who the people are;
- branding for the title cards (logo, font, colours);
- what to mask on screen (emails, phone numbers, fields).

Full list: [`references/questionnaire.md`](references/questionnaire.md). Every field:
[`references/settings.md`](references/settings.md).

## Example flow

1. **Story.** "Dana invites Omer to her team; Omer accepts." Claude proposes the steps
   ("Dana invites a teammate", "Omer accepts the invitation"), the people, and chapters with side
   notes ("Invitation expires in 7 days").
2. **Approved chapters.** You approve or change them. The approval is recorded in the plan — the
   tools refuse to record chapters nobody approved.
3. **Seed.** Claude asks what data the story needs and uses or drafts a seed command that creates
   it for one run id (`Team <run id>`).
4. **Test.** Claude writes `guide-videos/invite-a-teammate.scenario.ts` (or hooks your existing
   test) and `guide-videos/invite-a-teammate.plan.ts`.
5. **Recording.** With the app running:
   ```
   npm --prefix guide-videos/tools run video -- invite-a-teammate
   ```
   Health check → seed → the scenario with recording on → the cut.
6. **Cut videos.** `guide-videos/output/01_invite-a-teammate/videos/01_dana-invites.mp4` and `.srt`,
   plus `video-log.md`. Claude reads the log with you; a plan change re-cuts without recording:
   `… run video -- invite-a-teammate --build-only guide-videos/output/01_invite-a-teammate`.

## Outputs

In `<output folder>/<nn>_<scenario>/`:

| file | what |
|---|---|
| `videos/<file>.mp4` | the guide videos, one per video in the plan (H.264, 25 fps) |
| `videos/<file>.srt` | the same captions as subtitles, on the cut video's clock |
| `video-log.md` | what was used (command, exit code, run id, seed, app, commit, ffmpeg, plan, clip rule), every problem while recording, and per video every action — kept or cut and why — with the caption shown and a flag on captions that read like developer words |
| `scenario-report.md` | the scenario's own result: failed checks, every browser error, parts, watchdog samples |
| `scenario.log` · `seed.log` | the scenario's and the seed's output |
| `timeline.jsonl` · `pages.jsonl` · `problems.jsonl` · `recording-plan.json` · `run-result.json` | the recording's raw facts — what `--build-only` cuts again |
| `raw/*.webm` | Playwright's recording of every browser context |

A failed scenario makes **no video** unless `--accept-failed-run` is passed (the log says so). A
person the plan names and the run never recorded, or whose every action was cut, is **NOT MADE**
in the log, and the command exits 1.

## Commands

```
npm --prefix <tools> run video -- <scenario>                         record and cut
npm --prefix <tools> run video -- <scenario> --into <folder>         record into a given folder
npm --prefix <tools> run video -- <scenario> --build-only <folder>   cut an existing recording again
npm --prefix <tools> run video -- <scenario> --accept-failed-run     build although the scenario failed
npm --prefix <tools> run self-check                                  prove the tools on this machine (≈20s, no app)
npm --prefix <tools> run typecheck                                   typecheck the tools
npm --prefix <tools> run check-templates                             typecheck the templates against the tools
```

Environment: `APP_ADDRESS` (one-run override), `SCENARIO_RUN_ID` (fix the run id),
`SCENARIO_PARTS=a,b` (run some parts), `SHOW_BROWSER=yes` (visible browser), and each person's
password variable.

## Hebrew and right-to-left

Set `"captions": { "language": "he", "direction": "rtl" }`. Then:

- the title card and the strip are laid out right to left; a long Hebrew heading (a full sentence)
  wraps, and is stepped down from 54px only when it would not fit the frame;
- captions use the control's own visible Hebrew words, in Hebrew quotes: `לוחצים על ״שמירה״`;
- the pointer lands on the control wherever RTL layout put it;
- the `.srt` wraps each line in a right-to-left embedding so players keep punctuation at the right end;
- the video log flags a caption with no Hebrew, or with a Latin-only quoted part;
- the cut rules match Hebrew words (`{ what: /^סגירה$/ }`).

The self-check runs in Hebrew on an RTL page and proves all of the above, plus a left-to-right card
for an English look. Details: [`references/hebrew-rtl.md`](references/hebrew-rtl.md).

## What the recording guarantees

- The overlay is invisible to the test: a closed shadow root, `pointer-events: none`, no attribute
  added, no text in the page — `elementFromPoint`, locators and text reads never see it.
- Masking paints over emails, phone numbers and chosen fields without changing the page's DOM or text.
- Zero browser errors: console errors, uncaught errors, failed requests and the app's 4xx/5xx fail
  the run (after one reload of the page it happened on).
- Every wait is on state; a stall (30 identical one-second samples) ends the run by name.
- Every failure in the tools is a named error (`[app.not_reachable] …`, `[seed.failed] …`,
  `[plan.invalid] …`); nothing is swallowed.

## Limits of v1

- Web apps only, Chromium only (masking uses the CSS highlight registry, Chromium 105+).
- Captions only — no narration or voice-over, no music.
- The tools never start or stop the app; it must be running and pass its health check.
- The seed is the project's command; the tools do not clean seeded data up or reset a database.
- An existing Playwright test is hooked with four small changes and runs with `--workers=1`;
  several people inside one existing test need the recorder calls by hand.
- A caption or chapter change needs a new recording; only cut rules re-cut with `--build-only`.
- The strip holds one phrase per side note (44 characters); longer is cut on screen and logged.
- Pacing is fixed: 3s title card + 0.35s fade, 0.9s pointer travel, 0.5s before typing, clips of at
  most 2s after an action.

## Layout

```
scenario-video/
  SKILL.md                 the workflow Claude follows
  README.md                this file
  references/              questionnaire, settings, scenarios, existing tests, plans and chapters, seeding, RTL
  templates/               settings, scenario, plan, seed, existing-test examples
  scripts/                 the tools copied into a repository
    src/make.ts            record + cut (the `video` command)
    src/recorder.ts        the hooks: contexts, pages, title cards, captions, pointer, timeline
    src/overlay.ts         what is drawn in the page, and the masking
    src/build.ts           the cutter (ffmpeg-static), subtitles, the video log
    src/captions.ts · plan.ts · config.ts · subtitles.ts · errors.ts · log.ts
    src/runtime/           the scenario runtime: people, sign-in, controls, listeners, watchdog, parts, races, report
    src/hook/              the hook for an existing @playwright/test test
    src/self-check.ts      the tools, proven without an app
```
