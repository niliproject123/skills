# Setting the app up for videos — what to change in its code

A video is a browser run of the real app. Some apps can be filmed as they are; most need a few
small changes first, all of them things a test suite wants anyway. Go through this list with the
user before the first scenario, say which items the app already has, and propose the change for
each one it lacks. Nothing here changes what a user sees.

## 1. Controls a scenario can find without the wording
- A test id on every control the film presses — buttons, tabs, menu items, row actions:
  `data-testid="save"` (or the attribute the settings name). Without one, scenarios find controls
  by role and text, and a reworded button breaks the video.
- A test id on every **row** of a list or table, carrying the row's own key (`data-row="<id>"`),
  and on every **panel** that opens (a side card, a dialog): the film points at them.
- Keys, not wording, in these attributes: the caption is read from the visible text, the scenario
  finds the control by the key.

## 2. State a scenario can wait on
A scenario never sleeps; it waits for the page to say it is ready. The app exposes that:
- a loading marker while data is read (`data-loading="true"` on the block, or a `[aria-busy]`);
- open/closed on everything that opens (`data-open`, `aria-expanded`), and which item is current
  (`aria-current`, `aria-selected`);
- a count where a list is drawn (`data-rows="12"`), so a scenario knows the rows are in.
Without these a scenario either waits blindly or races the app.

## 3. Signing in without typing a password each time
- A sign-in api call that returns a token, and the place the app keeps it (localStorage,
  sessionStorage or a cookie). The tools write it before any app script runs.
- Or a stable sign-in form (test ids on the fields and the button, and something visible once
  signed in). Both go into the settings (`signIn`).
- The accounts the films show exist in a seeded database; their passwords come from environment
  variables, never from the repository.

## 4. Data that is the same on every run
- A seed command that prepares the starting position for one run, keyed by a run id
  (`references/seeding.md`): the accounts, and the record in the state the story starts from.
- Invented values are marked (a prefix, a flag) so they are never taken for real data — and so a
  caption can leave the mark out.

## 5. A film that must not change anything
A **tour** film (a walk through a screen) shows what can be done and does none of it. For the film
to prove that, the app's writes must be recognisable from the browser: the api uses write verbs
(POST, PUT, PATCH, DELETE) for writes and GET for reads. The scenario then ends with "every call
was a GET". An app that writes on a GET cannot make that promise, and the film should say so.

## 6. Things on screen that get in the way
- Toasts, cookie banners, "what's new" dialogs: each needs a way to close it that a scenario can
  press (a test id), or a setting that keeps it closed during a test (declare them in
  `dismissibleOverlays`).
- Animations are fine: the pointer and ring follow an element while it slides or grows, and
  settle where it stops (`overlay.ts` `follow`). Nothing needs to be switched off for a video.
- Ids and keys shown on screen as a row's name (``RULE-17``, `Q-1`) read badly in a caption. If a
  row has a readable name, show it; the scenario captions from the visible cells.

## 7. Where the app runs
- A start command, an address and a health check that answers 2xx when the app is up
  (`app.startCommand`, `app.address`, `app.healthCheck`). The tools never start the app; Claude
  starts it with `startCommand` only after the user agrees.
- A second copy of the app per branch or per developer helps: a recording is minutes of a real
  browser against a real database, and nobody else should be writing to it meanwhile.

## After the changes
Run the self-check (`npm --prefix <tools> run self-check`), then `SCENARIO_PARTS=sign-in` on the
first scenario: it proves the seed and every sign-in before anything is filmed.
