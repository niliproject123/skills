/**
 * invite-a-teammate — Dana invites Omer to her team, and Omer accepts.
 *
 * Purpose: the scenario behind the guide video "Inviting a teammate". It exists because the video
 * needs it; it is also a plain test (exit code 0 = it passed).
 * People: Dana, Omer (from .claude/scenario-video.config.json).
 * Seed: the settings' seed command, run by make.ts with SCENARIO_RUN_ID — it creates the team
 *   "Team <run id>" with Dana as its owner and no pending invitations.
 * Env: SCENARIO_RUN_ID (set by make.ts), SCENARIO_PARTS (optional), SHOW_BROWSER=yes to watch.
 *
 * Run as a video:  npm --prefix guide-videos/tools run video -- invite-a-teammate
 * Run as a test:   npx --prefix guide-videos/tools tsx guide-videos/invite-a-teammate.scenario.ts
 */
import { runScenario, type Person } from './tools/src/runtime/scenario';

interface World {
  dana: Person;
  omer: Person;
}

runScenario<World>({
  name: 'invite-a-teammate',
  startUp: async (s) => ({ dana: await s.openPerson('Dana'), omer: await s.openPerson('Omer') }),
  parts: [
    {
      key: 'send-invite',
      title: 'Dana invites a teammate',
      subtitle: 'Team: 1 member',
      needs: [],
      run: async ({ dana }, s) => {
        await dana.goto('/team');
        await dana.press('invite-button');
        await dana.fill({ label: 'Email' }, 'omer@example.com');
        await dana.press({ role: 'button', name: 'Send invitation' });
        // Wait on state, never on sleep: the ways this can end are named and raced.
        const ended = await s.race('the invitation is sent', [
          { name: 'sent', wait: () => dana.waitFor({ text: 'Invitation sent' }) },
          { name: 'refused', wait: () => dana.waitFor({ role: 'alert', name: /already|invalid/i }) },
        ], 20_000);
        s.check('the invitation was sent', ended.name === 'sent', `ended as ${ended.name}`);
      },
    },
    {
      key: 'accept-invite',
      title: 'Omer accepts the invitation',
      subtitle: 'Team: 2 members',
      needs: ['send-invite'],
      run: async ({ omer }, s) => {
        await omer.goto('/invitations');
        await omer.press({ role: 'button', name: 'Accept' });
        await omer.waitFor({ text: `Team ${s.runId}` });
        s.check('Omer sees the team', await omer.locate({ text: `Team ${s.runId}` }).isVisible());
      },
    },
  ],
});
