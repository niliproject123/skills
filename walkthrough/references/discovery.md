# What to find out from the code, without asking

Read these before proposing the brief; put the findings in its "What the code already gives" table.

## 1. Stack and Playwright

- The web stack (React, Vue, server-rendered…) and how the app starts: `package.json` scripts,
  dev-server config, ports in `.env*`.
- Whether `playwright` (or `@playwright/test`) is a dependency, and its version. If it is missing,
  **propose** installing it with the walk (`npm i -D playwright tsx typescript @types/node`, then
  `npx playwright install chromium`). Run the install only after the brief is approved. Report every
  error and warning of the install verbatim; never skip one, never continue past a failed install.
- Whether TypeScript runs through `tsx` already. The templates need ES2022, strict mode, `DOM` lib.

## 2. How elements are identified

- Grep the components for `data-testid`, `data-test`, `data-cy`, `data-qa`, and the app's own `data-*`
  attributes. Use what exists; do not introduce a second convention.
- For **every element the scenario touches** — each button, field, menu item, row, and each panel
  whose content a step checks — note whether it has a stable id. List the ones that do not, as rows of
  "Test ids to add": element, screen, proposed attribute. Make the change only after the user agrees.
  Wording-based locators (`getByText`) break when the wording changes; the brief says so when the user
  declines ids.
- A section attribute (`data-section="members"`) on the blocks of a screen lets the ring scroll the
  section into view before the control, and lets ״Back״ return to it. Propose it when screens are long.
- What counts as "opened by a press" in this app: its dialogs, menus, side panels — for
  `openedByPressSelector`.
- `scenario-video`'s `references/app-setup.md` lists the same app changes for films; the two skills ask
  for the same ids.

## 3. Routes, screens and signals per step

For each step: the route or screen it starts on, the control it touches, and **how the app says the
step ended** — the thing a step waits on instead of sleeping:

- success: a row appears with a known attribute, a status attribute changes, the URL changes;
- error: an alert role, an error panel, a 4xx answer (a refusal the scenario expects is declared with
  `step.expectAnswer`);
- loading: `aria-busy`, a `data-loading` attribute, a spinner that leaves.

A signal that **outlives its action** is a trap: a toast or bubble that stays a few seconds, carrying the
same attribute the next step waits on (see `mechanisms.md`, the four-second toast). Note such signals and
scope every read to the panel or row of this action.

If the app gives no signal for a step, propose one (an attribute on the result) in "Test ids to add".

## 4. Sign-in

- The sign-in form's fields and button, and what shows **who** is signed in (a header attribute, the
  user menu's label) — `whoIsSignedIn` compares it with the person's username after every sign-in.
- The sign-out control and what shows it worked (the form is back).
- Accounts: the seed, fixtures, existing e2e tests. Passwords stay in environment variables.

## 5. Data: seed, fixtures, cleanup

- An existing seed or fixture mechanism that takes an id or a flag — reuse it before writing anything.
- How a created row can be found again by the run id (a name, a title, a reference field).
- How to remove what a run created, by run id, **including what the app created around it** (a log
  line, an upload, a notification). A cleanup that deletes by name only and fails on a foreign key is a
  correct failure — report it, do not force it.
- No seed and no cleanup → the brief says the walk uses existing data and writes nothing that must go,
  and the user confirms it. `scenario-video`'s `references/seeding.md` covers writing a seed.
