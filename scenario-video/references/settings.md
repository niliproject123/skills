# `.claude/scenario-video.config.json` — field reference

Every field is required unless marked optional; a missing or wrong field stops the tools with
`[settings.bad_field] <path> must be …`. Example: `templates/scenario-video.config.example.json`.

| field | what |
|---|---|
| `app.address` | Where the app opens: `http://localhost:5173`. `APP_ADDRESS` overrides it for one run. |
| `app.healthCheck` | Must answer 2xx before a recording starts. |
| `app.startCommand` | Printed when the health check fails. The tools never start the app; Claude runs it only after the user agrees. |
| `app.otherAddresses` | The app's other origins; their 4xx/5xx answers are browser errors. `[]` for none. |
| `signIn.method` | `none` · `form` · `token` |
| `signIn.page`, `usernameField`, `passwordField`, `submit`, `signedInWhen` | `form` only. Selectors; `signedInWhen` is visible once signed in. |
| `signIn.request` `{ address, method, body }` | `token` only. `{username}` / `{password}` in body values are replaced. |
| `signIn.tokenAt` | `token` only. Dotted path to the token in the answer: `data.token`. |
| `signIn.keep` `{ where, name }` | `token` only. `localStorage` · `sessionStorage` · `cookie`, and its key. Written before any app script runs. |
| `people[]` `{ name, username, passwordVariable }` | `name` is what scenarios, plans and the screen use. `username` and `passwordVariable` are required unless `signIn.method` is `none`. |
| `seed` | `{ "command": "…{runId}…" }` or `null`. Run from the repository root with `SCENARIO_RUN_ID` set. |
| `locators.testIdAttribute` | `data-testid` or another attribute; `null` for none (role/label/text locators, with a warning). |
| `folders.scenarios` / `tools` / `output` | Relative to the repository root. |
| `captions.language` | `he`, `en` built in; anything else needs `captions.words`. Also sets the browser locale. |
| `captions.direction` | `rtl` · `ltr` — the title card, the strip and the subtitles. |
| `captions.words` (optional) | `{ press, fill, people }`; `press` and `fill` contain `{name}`. Overrides the built-in words. |
| `videoShape` | `per-person` · `per-scenario` — the default the skill proposes for a plan's videos. |
| `branding.logo` | Path to png / jpg / svg / webp, or `null`. Drawn above the title. |
| `branding.font` | A CSS font-family, or `null` for `"Segoe UI", Arial, sans-serif`. |
| `branding.colours` | Any of `strip`, `card`, `text`, `person`, `subtitle`, `step`, `sideNote`, `slideNote`, `pointer`, `mask`. `{}` keeps the default look. |
| `masking.patterns` | `email`, `phone` — matching text is painted over; `input[type=email|tel]` blurred. |
| `masking.fields` | CSS selectors blurred on screen. |
| `viewport` | `{ width, height }` of every recorded browser. |

Environment variables the tools read: `APP_ADDRESS`, `SCENARIO_RUN_ID`, `SCENARIO_PARTS`,
`SHOW_BROWSER=yes`, each person's password variable. Set for the scenario by `make.ts`:
`VIDEO_RECORDING_FOLDER` (turns recording on), `SCENARIO_RUN_ID`, `VIDEO_SETTINGS_FILE`.
