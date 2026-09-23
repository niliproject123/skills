# Seeding the data a recording needs

A recording starts from known data, or the video shows whatever the database happened to hold.
The seed is the project's own command; the skill helps write it when there is none.

## What to ask the user
- Which people must exist, and with which roles?
- Which records must exist, and in which state, for the first step to make sense?
- What must **not** exist (a pending invitation that would change the screen)?
- How does the project create data today — an api, a seed script, migrations with fixtures, a
  database client? Prefer the app's own api: its rules then apply to seeded rows as to a user's.

## Rules for the seed
1. It takes the run id (`--run {runId}` in the settings' command, or `SCENARIO_RUN_ID`) and puts it
   in every name it creates — `Team <run id>` — so the scenario finds its rows and two recordings
   never share them.
2. Any failure exits non-zero with a message. `make.ts` then records nothing and says so.
3. It prints one line per thing it created; the output is kept as `seed.log` beside the video.
4. The app's server never seeds on boot for this; the seed is a deliberate command.

Template: `templates/seed.example.mjs` (Node, through an HTTP api). Write it in the project's own
stack when that is more natural — a `manage.py` command, a `rake` task, an `npm run` script — and
put the exact command in `seed.command`. A plan may override it (`seed: { command }`) or turn it off
(`seed: false`) for a scenario that needs no data.

## What the tools do not do
They do not clean seeded rows up, and they do not reset the database. If the project wants that,
it is another command the user runs; say so when proposing the seed.
