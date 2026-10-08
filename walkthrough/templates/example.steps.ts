/**
 * The steps of "invite a teammate" — Dana invites Omer, Omer accepts. One step per row of the approved
 * step list (references/building.md "Delivery order"), in its order, with its number.
 *
 * A step's shape: number (null for a connecting press the scenario takes for granted), key, actor,
 * caption (one line), description (the scenario's words: what happens and what should be seen), expects
 * (the requirement ids it proves), run. Every touch goes through `step.act`, every wait is on state, and
 * every check is named after its requirement.
 */
import type { WalkSection } from './walk/types';
import { untilRaceEnds } from './walk/outcomes';

/** What the steps share: what one step created and a later one reads. */
export interface InviteWorld {
  runId: string;
  teamName: string;
  invitedEmail: string;
}

export const INVITE_SECTIONS: WalkSection<InviteWorld>[] = [
  {
    title: 'Inviting',
    steps: [
      {
        number: 1, key: 'open-team', actor: 'dana', expects: ['R1'],
        caption: 'Dana opens her team',
        description: 'Dana opens Team from the top menu. Her team is listed with one member: herself.',
        run: async (step, world) => {
          await step.goto('/');
          await step.act.press(step.page.getByTestId('menu-team'), 'Team');
          await step.page.getByTestId('team-members').waitFor({ state: 'visible', timeout: 20_000 });
          step.checks.same('R1', 'the team has one member before the invitation',
            await step.page.getByTestId('team-member-row').count(), 1);
          step.checks.same('R1', 'the team carries this run\'s name',
            await step.page.getByTestId('team-name').textContent(), world.teamName);
        },
      },
      {
        number: 2, key: 'send-invite', actor: 'dana', expects: ['R2', 'R3'],
        caption: 'Dana invites Omer',
        description: 'Dana presses Invite, types Omer\'s email and sends. The invitation shows as pending, for 7 days.',
        run: async (step, world) => {
          const { page, act } = step;
          await act.press(page.getByTestId('invite-open'), 'Invite');
          await act.fill(page.getByTestId('invite-email'), world.invitedEmail, 'Email');
          // Time the app, not the person or the ring: the clock starts when the touch has returned. A touch holds
          // the ring for ringHoldMs first, and a step's first touch waits for Next (references/mechanisms.md, the
          // clock that counted the wait for Next). To time from a moment before any touch, `act.point` the
          // control first — the gate and the hold are then spent before the clock starts.
          await act.press(page.getByTestId('invite-send'), 'Send');
          const pressedAt = Date.now();
          const ended = await step.race('the invitation is answered', [
            { name: 'pending', wait: (over) => untilRaceEnds(over, 20_000, (ms) => page.locator(`[data-invitation="${world.invitedEmail}"][data-state="pending"]`).waitFor({ timeout: ms })) },
            { name: 'refused', wait: (over) => untilRaceEnds(over, 20_000, (ms) => page.getByTestId('invite-error').waitFor({ timeout: ms })) },
          ], 20_000);
          step.checks.check('R2', 'the invitation is pending', ended.name === 'pending', { expected: 'pending', received: ended.name });
          const answeredMs = Date.now() - pressedAt;
          step.checks.check('R2', 'the invitation is answered within 2 s', answeredMs < 2_000, { expected: '< 2000 ms', received: `${answeredMs} ms` });
          const expiry = await page.locator(`[data-invitation="${world.invitedEmail}"]`).getAttribute('data-expires-in-days');
          if (expiry === null) step.checks.notChecked('R3', 'the invitation expires in 7 days', 'the row carries no data-expires-in-days — propose adding it (references/discovery.md)');
          else step.checks.same('R3', 'the invitation expires in 7 days', expiry, '7');
        },
      },
    ],
  },
  {
    title: 'Accepting',
    steps: [
      {
        number: 3, key: 'accept-invite', actor: 'omer', expects: ['R4'],
        caption: 'Omer accepts the invitation',
        description: 'Omer opens Invitations and accepts. He lands on the team, which now has two members.',
        run: async (step, world) => {
          await step.goto('/invitations');
          await step.act.press(step.page.locator(`[data-invitation-team="${world.teamName}"] [data-testid="invitation-accept"]`), 'Accept');
          await step.page.getByTestId('team-members').waitFor({ state: 'visible', timeout: 20_000 });
          step.checks.same('R4', 'the team has two members', await step.page.getByTestId('team-member-row').count(), 2);
        },
      },
    ],
  },
];
