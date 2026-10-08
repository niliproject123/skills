/**
 * walkthrough-invite-a-teammate — a guided walk of "invite a teammate", one step at a time behind Next.
 *
 * Purpose: the approved scenario (walkthroughs/invite-a-teammate.brief.md), walked in the browser as the
 *   people in it, a strip over the app saying before each step what happens, and after it what came out.
 * People: Dana (owner), Omer (invited). One window: a change of person signs out and in on the app's form.
 * Data: `npm run seed:walk -- --run {runId}` creates "Team <runId>" owned by Dana and nothing pending;
 *   `npm run seed:walk -- --clear --run {runId}` removes everything named with the run id, green or red.
 * Mocked: nothing — no response intercepted, no stubbed api; the four browser listeners only observe.
 * Env: DANA_PASSWORD, OMER_PASSWORD; WALK_MODE (stepped | auto), WALK_START_STEP, WALK_HEADLESS (auto only),
 *   WALK_RUN_ID, WALK_KEEP_DATA, WALK_APP_ADDRESS.
 * Run: npm run walkthrough-invite-a-teammate   (→ npx tsx walkthroughs/invite-a-teammate.walk.ts)
 * The exit code is the result: 0 only when no check failed, no browser error was seen, every step ran and
 * the cleanup succeeded.
 */
import { runWalk } from './walk/runner';
import type { AppHooks, WalkConfig } from './walk/types';
import { INVITE_SECTIONS, type InviteWorld } from './example.steps';

const config: WalkConfig = {
  name: 'walkthrough-invite-a-teammate',
  appAddress: 'http://localhost:5173',
  productionAddresses: ['https://app.example.com'],
  allowProductionWrites: false,
  appOrigins: ['http://localhost:5173', 'http://localhost:3000'],
  direction: 'ltr',
  dictionaryFile: 'walkthroughs/dictionary.en.json',
  people: [
    { key: 'dana', name: 'Dana', username: 'dana@example.com', passwordVariable: 'DANA_PASSWORD' },
    { key: 'omer', name: 'Omer', username: 'omer@example.com', passwordVariable: 'OMER_PASSWORD' },
  ],
  sectionAttribute: 'data-section',
  openedByPressSelector: '[role="dialog"], [role="menu"], dialog, [data-side-panel]',
  reportFolder: 'walkthroughs/reports',
  seedCommand: 'npm run seed:walk -- --run {runId}',
  cleanupCommand: 'npm run seed:walk -- --clear --run {runId}',
  ringHoldMs: 600,
  headlessViewport: { width: 1440, height: 900 },
};

/** The app's own sign-in and sign-out, through its own screens — every touch through `act`. */
const hooks: AppHooks = {
  signIn: async (page, person, password, act) => {
    await page.getByTestId('sign-in-form').waitFor({ state: 'visible', timeout: 30_000 });
    await act.fill(page.getByTestId('sign-in-email'), person.username, 'Email');
    await act.fill(page.getByTestId('sign-in-password'), password, 'Password'); // the password is never logged
    await act.press(page.getByTestId('sign-in-submit'), 'Sign in');
    await page.locator('[data-signed-in-as]').waitFor({ state: 'attached', timeout: 30_000 });
  },
  signOut: async (page, _person, act) => {
    await act.press(page.getByTestId('user-menu'), 'User menu');
    await act.press(page.getByTestId('sign-out'), 'Sign out');
    await page.getByTestId('sign-in-form').waitFor({ state: 'visible', timeout: 30_000 });
  },
  whoIsSignedIn: async (page) => (await page.locator('[data-signed-in-as]').getAttribute('data-signed-in-as')) ?? '',
  // unfoldSection: omitted — this app folds no sections.
};

runWalk<InviteWorld>({
  config,
  hooks,
  sections: INVITE_SECTIONS,
  makeWorld: (runId) => ({ runId, teamName: `Team ${runId}`, invitedEmail: 'omer@example.com' }),
  finish: async (step, world) => {
    // What the walk should have left: the invitation accepted, nothing pending (read through the screen).
    await step.goto('/team');
    step.checks.same('R4', 'no invitation of this run is still pending',
      await step.page.locator(`[data-invitation="${world.invitedEmail}"][data-state="pending"]`).count(), 0);
  },
});
