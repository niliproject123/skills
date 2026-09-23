// Hooking an existing @playwright/test test into a guide video, without rewriting it.
//
//   // tests/invite.spec.ts
//   import { test as base, expect } from '@playwright/test';
//   import { withGuideVideo, pressFor, fillFor, videoStep } from '../guide-videos/tools/src/hook/playwright-test';
//   const test = withGuideVideo(base);
//   test.use({ person: 'Dana' });
//   test('invite a teammate', async ({ page }) => {
//     videoStep('Inviting a teammate');
//     await page.goto('/team');
//     await pressFor(page, page.getByRole('button', { name: 'Invite' }));
//     await fillFor(page, page.getByLabel('Email'), 'omer@example.com');
//   });
//
// The project's own `test` is passed in, never imported here: this file loads nothing of
// Playwright at run time (type imports only), so the test runs on the project's one copy of
// @playwright/test — a second copy makes Playwright refuse to start.
//
// With `VIDEO_RECORDING_FOLDER` unset (a normal test run) the fixtures behave exactly like
// Playwright's own and the helpers only click and fill. Run it from a plan with
// `run: { command: ['npx', 'playwright', 'test', 'invite.spec', '--workers=1'] }` — one
// worker, so the people's clips interleave on one clock and the film cuts in the order things happened.
import type { test as PlaywrightTest } from '@playwright/test';
import type { Locator, Page } from 'playwright';
import {
  guideBeforeFill, guideBeforePress, guideContextOptions, guideStep, isRecordingGuide, nameGuidePage, noteGuidePageOpened,
  prepareGuideContext,
} from '../recorder';

/** The project's `test`, with a `person` option and recorded `context` and `page` fixtures. */
export function withGuideVideo(base: typeof PlaywrightTest) {
  return base.extend<{ person: string }>({
    /** Whose screen this test's page is — the name the plan's `who` matches. */
    person: ['viewer', { option: true }],
    // Asking for `context` inside its own override gives Playwright's ordinary one (documented
    // fixture-override behaviour); it is handed on untouched whenever nothing is being recorded.
    context: async ({ browser, contextOptions, viewport, context: ordinaryContext }, use) => {
      if (!isRecordingGuide()) {
        await use(ordinaryContext);
        return;
      }
      const size = viewport ?? { width: 1280, height: 720 };
      const recorded = await browser.newContext({ ...contextOptions, viewport: size, ...guideContextOptions(size) });
      await prepareGuideContext(recorded);
      await use(recorded);
      // Closing finishes the video file; a context left open leaves it unfinished.
      await recorded.close();
    },
    page: async ({ context, person }, use) => {
      const page = await context.newPage();
      noteGuidePageOpened(page);
      await nameGuidePage(page, person);
      await use(page);
    },
  });
}

/** A step's title card and the name the plan matches — call it where the step begins. */
export function videoStep(title: string, subtitle?: string): void {
  guideStep(title, subtitle);
}

/** Pointer and caption, then the click. `what` names it when the control's own words are not enough. */
export async function pressFor(page: Page, control: Locator, what?: string): Promise<void> {
  await control.waitFor({ state: 'visible' });
  await guideBeforePress(page, control, what ?? '');
  await control.click();
}

export async function fillFor(page: Page, control: Locator, value: string, what?: string): Promise<void> {
  await control.waitFor({ state: 'visible' });
  await guideBeforeFill(page, control, what ?? '');
  await control.fill(value);
}
