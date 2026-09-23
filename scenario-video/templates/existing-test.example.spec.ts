// An existing @playwright/test test, hooked into guide videos with four changes:
//   1. `test` is the project's own, passed through `withGuideVideo` (never a second copy of Playwright);
//   2. `test.use({ person })` names whose screen this is — the plan's `who` matches it;
//   3. `videoStep(title)` where each step begins — the title card, and what the plan matches;
//   4. `pressFor` / `fillFor` where a press or a fill should be captioned and pointed at.
// With recording off (a normal `npx playwright test`), all four behave as plain Playwright.
// The plan runs it with: run: { command: ['npx', 'playwright', 'test', 'invite.spec', '--workers=1'] }
import { test as base, expect } from '@playwright/test';
import { withGuideVideo, pressFor, fillFor, videoStep } from '../guide-videos/tools/src/hook/playwright-test';

const test = withGuideVideo(base);

test.use({ person: 'Dana' });

test('Dana invites a teammate', async ({ page }) => {
  videoStep('Dana invites a teammate');
  await page.goto('/team');
  await pressFor(page, page.getByRole('button', { name: 'Invite' }));
  await fillFor(page, page.getByLabel('Email'), 'omer@example.com');
  await pressFor(page, page.getByRole('button', { name: 'Send invitation' }));
  await expect(page.getByText('Invitation sent')).toBeVisible();
});
