# Hooking an existing Playwright test

When the story already has a `@playwright/test` test, change four things instead of writing a
scenario. Template: `templates/existing-test.example.spec.ts`.

1. Wrap the project's own `test`:
   ```ts
   import { test as base, expect } from '@playwright/test';
   import { withGuideVideo, pressFor, fillFor, videoStep } from '../guide-videos/tools/src/hook/playwright-test';
   const test = withGuideVideo(base);
   ```
   The hook loads nothing of Playwright at run time, so the test keeps using the project's one copy
   of `@playwright/test` (a second copy makes Playwright refuse to start).
2. `test.use({ person: 'Dana' })` — whose screen this is; the plan's `who` matches it.
3. `videoStep('Dana invites a teammate')` where each step begins — the title card, and the step
   name the plan's rules and chapters match.
4. `pressFor(page, locator, what?)` and `fillFor(page, locator, value, what?)` for the actions to
   caption and point at. Other clicks still happen and are filmed, without a caption.

With `VIDEO_RECORDING_FOLDER` unset (a normal `npx playwright test`), the fixtures are Playwright's
own and the helpers only click and fill.

## The plan
```ts
run: { command: ['npx', 'playwright', 'test', 'invite.spec', '--workers=1'] },
```
- `--workers=1`: one worker, so every person's clips share one clock and interleave correctly.
- The filter is a regular expression over the file path; on Windows the path has backslashes, so
  `tests/invite.spec.ts` matches nothing there — use the file name (`invite.spec`).
- Sign-in stays the test's own business (its `storageState`, a login step, …): the hook does not
  sign anybody in. A login done before the first `pressFor` is cut out of the video by itself.
- Several people in one test: open a second context from `browser`, call the recorder's
  `guideContextOptions`, `prepareGuideContext`, `noteGuidePageOpened` and `nameGuidePage` on it
  (see `src/hook/playwright-test.ts` for the order), or write a scenario instead.

## When not to hook
A test that grades every control — each search twice, refusals pressed on purpose, every "more"
opened — makes a film that is mostly checks, and `leaveOut` rules cannot rescue it. Write a short
scenario for the film instead (a tour, `plans-and-chapters.md`), and leave the test as it is.
