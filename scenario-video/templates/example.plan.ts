// The guide plan for `invite-a-teammate.scenario.ts`: which person's recording becomes which
// video, what is left out, and the chapters the person approved.
//
// The rules match the scenario's own words — its part titles and what it pressed — never a time or
// a click count. After a recording, read video-log.md and adjust:
//   • a kept action that is a check, not a user's action → a `leaveOut` rule;
//   • the same action repeated → a `keepAtMost` rule;
//   • a caption flagged "reads like a developer word" → a `captionRules` entry, or a label in the app;
//   • NOT MADE → the scenario names a person differently; follow it here.
// Then re-cut without recording again: npm --prefix guide-videos/tools run video -- invite-a-teammate --build-only <folder>
import type { GuidePlan } from './tools/src/plan';

export const plan: GuidePlan = {
  name: 'invite-a-teammate',
  run: { scenario: 'invite-a-teammate.scenario.ts' },
  // An existing Playwright test instead of a scenario (one worker, so clips share one clock):
  // run: { command: ['npx', 'playwright', 'test', 'invite.spec', '--workers=1'] },
  videos: [
    {
      file: '01_dana-invites',
      who: 'Dana',
      title: 'Inviting a teammate',
      leaveOut: [{ what: /^Close$/, why: 'closing a dialog to reach the next control is navigation, not a step' }],
      keepAtMost: [],
    },
    {
      file: '02_omer-accepts',
      who: 'Omer',
      title: 'Accepting an invitation',
      leaveOut: [],
      keepAtMost: [],
    },
    // One film that follows the story across both people, cut in the order things happened:
    // { file: '00_the-whole-story', who: ['Dana', 'Omer'], title: 'Inviting and joining', leaveOut: [], keepAtMost: [] },
  ],
  chapters: [
    {
      step: /^Dana invites a teammate$/,
      people: ['Dana — team owner'],
      sideNotes: ['Invitation expires in 7 days'],
      slideNotes: ['Only a team owner can invite'],
    },
  ],
  // Chapters are words put in the product's mouth: they are shown to the person first, and make.ts
  // refuses to record chapters with no approval.
  chapterApproval: { approvedBy: 'Dana Levi', approvedOn: '2026-09-23' },
  captionRules: [{ kind: 'press', match: /^Tab (.+)$/, say: 'Open the “$1” tab' }],
};
