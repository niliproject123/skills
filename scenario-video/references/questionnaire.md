# Asking the user — as little as possible

The user answers **two messages** in total: one confirming the settings (first use only), one
approving the video proposal (every video). Everything the repository can answer is read, not
asked. A question is asked only when the repository gives no answer and no sensible default exists.

---

## A. Settings — first use in a repository

Fill every field of `.claude/scenario-video.config.json` yourself (`settings.md`), then show it as
a short table: field · value · where it came from (`package.json`, `src/api/auth.ts`, default).
End with the few open questions, if any, and "Correct anything that's wrong."

### Where each answer comes from

| field | read it from | if not found |
|---|---|---|
| `app.startCommand`, `app.address` | `package.json` scripts, vite / next / webpack config, `.env*` ports | ask |
| `app.healthCheck` | a `/health` or `/api/health` route in the server code | the app's address |
| `app.otherAddresses` | the api base url in the client code or `.env*` | `[]` |
| `signIn` | the login page and the auth call (`localStorage.setItem`, cookie code, an existing e2e login helper) | ask |
| `people` | seed files, fixtures, existing e2e tests | ask |
| `people[].passwordVariable` | propose a descriptive name per person: `GUIDE_PASSWORD_DANA` | — |
| `seed.command` | an existing seed script taking an id or a flag | `null`, and offer to write one (step 4) |
| `locators.testIdAttribute` | grep the components for `data-testid` / `data-test` / `data-cy` | `null`, and say plainly that role/text locators break when wording changes |
| `captions.language`, `direction` | `<html lang dir>`, the i18n setup, the UI's own text | `en`, `ltr` |
| `branding.logo` | a logo in `public/` or `assets/` | `null` (default dark card) |
| `branding.font`, `colours` | — | default look |
| `masking.patterns` | — | `["email", "phone"]` |
| `masking.fields` | — | `[]` |
| `folders.*` | — | `guide-videos`, `guide-videos/tools`, `guide-videos/output` |
| `videoShape` | — | `per-scenario` |
| `viewport` | — | 1440 × 900 |

### Questions that are actually asked
Only those marked "ask" above that came up empty — usually none, at most three. Then one line of
instruction, never a question: "Set these password variables in your environment:
`GUIDE_PASSWORD_DANA`, …" — the passwords never go into the file.

---

## B. The video proposal — every new video

Read the story (the user's words, the existing test, the screens it touches) and write **one
proposal**. The user approves or corrects it in one reply. Ask a separate question only when the
story leaves something truly open (usually: who watches).

### The proposal, in this order

1. **Kind** — a *tour* (walks a screen, changes nothing, ends by proving every call was a read —
   `app-setup.md` §5) or a *story* (work from start to end, across the people who do it).
2. **Who watches** — a new user, an administrator, a customer, the team. It sets the wording.
3. **Films** — one film following everybody, or one per person, and who the people are.
4. **Steps** — each one a title card. For each: its title, and two short slide lines — what the
   step is **for**, and **why** a person comes to it. Plain words, the way a colleague says it;
   no filler, no marketing tone. For a tour: the areas, then one real item from each (the usual
   depth), unless the story says otherwise.
5. **What's on screen** — see below. Always shown, so the user can add or remove items.
6. **Start data** — what the seed must create for the first step to make sense (`seeding.md`).
7. **Left out** — checks a test does that a viewer should not see, repeated actions.
8. **Length** — the expected length per film; above about three minutes, propose a split.

End with: "Approve, or tell me what to change." The approval covers the chapters and slide lines;
record it in the plan's `chapterApproval` (who, date).

### What's on screen (item 5)

Show the user exactly what each overlay will carry, filled with this video's real values:

```
Title card (3s, at each step)     Strip (bottom, the whole step)
  logo (if set)                     whose screen: Dana
  subtitle: Team settings           subtitle: Team settings
  title: Dana invites a teammate    side notes: Invitation expires in 7 days
  people: Dana · Omer               step: Dana invites a teammate
  side notes: …                     caption: Click “Invite”
  card notes: Only an owner can invite
  whose screen: Dana
```

Then ask: "Anything else you want on screen, or anything to take off?"

- **Extra text** (a status, a deadline, a warning, a product version, a date) goes into the
  chapter's `sideNotes` (card and strip, ≤ 44 characters) or `slideNotes` (card only). No code
  change.
- **An item removed**, or **a new kind of item** (a step counter "2 / 5", a progress bar, a clock,
  a watermark): the overlay cannot do that yet. Say so plainly, propose the change to
  `scripts/src/overlay.ts` (and its settings field and self-check), and make it only after the user
  agrees — never fake it with a note.
