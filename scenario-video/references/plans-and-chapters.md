# Plans and chapters

A plan (`<scenarios folder>/<name>.plan.ts`, exporting `plan`) says how the scenario is run, which
recording becomes which video, what is left out, and — optionally — the chapters. Template:
`templates/example.plan.ts`. A plan matches the scenario's **words** (step titles, what was
pressed), never times or click counts, so it survives the test changing.

## Videos
`{ file, who, title, steps?, leaveOut, keepAtMost }`
- `who`: one person, or several — then the clips of all of them are joined in wall-clock order and
  the film cuts to whoever acts next.
- `steps`: only the steps whose title matches.
- `leaveOut: [{ step?, what, why }]` — an action that is a check, not something a user is shown.
  A fill right after a left-out press in the same step is cut with it.
- `keepAtMost: [{ what, count, why }]` — a repeated action kept `count` times per step.
- Every `why` is written beside the action it removed in `video-log.md`.

## What the cut keeps
Each kept action: 0.4s before it, until the next action on that page or 2s after it, whichever is
first — so the waits are not in the video. A title card: its 3s plus its 0.35s fade. A `watch`:
its `holdMs`. Clips closer than 0.3s join. Clips are re-encoded to H.264 at 25 fps and joined.

## Chapters (optional)
```ts
chapters: [{ step: /^Dana invites/, people: ['Dana — team owner'],
             sideNotes: ['Invitation expires in 7 days'], slideNotes: ['Only an owner can invite'] }],
chapterApproval: { approvedBy: 'Dana Levi', approvedOn: '2026-09-23' },
```
- **Title card** (3s, fades in and out): the step title, the scenario's `subtitle`, `people`,
  `sideNotes`, `slideNotes`, and whose screen it is. A long heading wraps and is shrunk from 54px
  until the card fits the frame.
- **Strip** (bottom, the whole step): whose screen, the subtitle, each side note on one line, the
  step, the current caption. A side note over 44 characters is cut with an ellipsis on screen and
  written into the video log's problems — shorten it.
- Put what the system deliberately does *not* do in `slideNotes`, so the film never implies it.
- **Approval is required.** Show the chapters and notes to the user before recording; `make.ts`
  refuses a plan with chapters and no `chapterApproval`.

## Captions
Built-in words: `Click “{name}”` / `Fill in “{name}”` (en), `לוחצים על ״{name}״` /
`ממלאים את ״{name}״` (he). A shape of label gets a rule:
`captionRules: [{ kind: 'press', match: /^Tab (.+)$/, say: 'Open the “$1” tab' }]`.
The video log flags a caption that reads like a developer word — a selector, a camelCase or
snake_case identifier, or Latin text in a Hebrew caption — so it gets a rule or a real label.

## After a plan change
Rules (`leaveOut`, `keepAtMost`, `steps`, `who`) re-cut without recording: `--build-only <folder>`.
Captions, chapters and the look are drawn during the recording — they need a new recording.
