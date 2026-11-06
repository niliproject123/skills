---
name: change-marks
description: Show someone in the browser what a change touched, instead of sending a diff — every changed line of a .tsx / .jsx / .html source is traced to the plain HTML element around it, outlined red with a numbered badge that opens what changed and why, and then taken back out byte for byte. Also marks a hand-written list of changes (a notes file) instead of the diff. Use it when someone wants to see a branch's or a session's UI changes on the running page, review changes visually, "mark what changed", or check that a list of changes points at the right screens.
---

# change-marks — what a change touched, drawn on the page

`on` reads `git diff`, traces every changed line up to the nearest plain HTML element that encloses
it, and writes three attributes into the source: `data-change` (the mark's number),
`data-change-note` (what changed — the subject of the commit the line belongs to, from `git blame`,
or "not committed yet") and `data-change-where` (file:line). A stylesheet block outlines every
`[data-change]` red, and a small overlay script draws a clickable number on each one; clicking it
opens a panel with the note. The dev server reloads and the reader sees the change where it is.

`off` takes all of it out — attributes, stylesheet block, overlay — and every file is back byte for
byte. **Marks are never committed.** Run `off` before any commit, and prove it with `git diff`.

## Where this skill lives

`C:\dev\skills\change-marks`, in git. Reach it from a machine through a junction:
`mklink /J "%USERPROFILE%\.claude\skills\change-marks" "C:\dev\skills\change-marks"`.
Do not copy the scripts into a project; point a project script at this folder instead.

## Setting a project up — once

Put `change-marks.config.json` in the project folder (the folder `git` and the paths are relative
to). `scripts/change-marks.config.example.json` is a starting point.

| key | default | what it is |
|---|---|---|
| `source` | `src` | folder whose UI files are read and marked |
| `extensions` | `[".tsx", ".jsx", ".html"]` | which files are UI source |
| `stylesheet` | — **required** | `.css` file the outline block is appended to, or an `.html` page (appended inside `<style>`) |
| `entry` | — **required** | the module that loads the overlay (`src/main.tsx` …: one `import` line is prepended and `change-marks-overlay.ts/.js` is written beside it), or an `.html` page (the overlay is appended inline in `<script>`) |
| `overlayFile` | beside `entry` | where the overlay module is written (module entries only) |
| `appRootId` | `root` | element id the overlay watches for re-renders; `document.body` when absent |
| `check` | `null` | a command, as a word list, that must pass after marking or the marks are taken back out — e.g. `["npx","tsc","--noEmit","-p","tsconfig.json"]`. `null` → the run says the marked source was not checked |
| `howToRun` | `node <this skill>/scripts/change-marks.mjs` | how the messages tell the reader to run `off` |
| `labels` | English | `notCommitted`, `panelHeading`, `badgeHint` — the words shown in the page (set Hebrew ones for an RTL app) |

Optional `package.json` aliases in the project:

```json
"marks":     "node C:/dev/skills/change-marks/scripts/change-marks.mjs",
"marks:on":  "node C:/dev/skills/change-marks/scripts/change-marks.mjs on",
"marks:off": "node C:/dev/skills/change-marks/scripts/change-marks.mjs off"
```

## Commands

Run from the project folder (or pass `--project <dir>`).

```
node <skill>/scripts/change-marks.mjs              # list: what is marked now, or what `on` would mark
node <skill>/scripts/change-marks.mjs on           # write the marks
node <skill>/scripts/change-marks.mjs off          # take them out, byte for byte
node <skill>/scripts/change-marks.mjs on --base main      # mark the whole branch, not just uncommitted work
node <skill>/scripts/change-marks.mjs --notes changes.json   # check every anchor, write nothing (exit 1 if one fails)
node <skill>/scripts/change-marks.mjs on --notes changes.json
```

Flags: `--project <dir>` · `--config <file>` · `--base <ref>` (default `HEAD`) · `--source <dir>` ·
`--stylesheet <file>` · `--entry <file>` · `--no-check` · `--notes <file.json>`. A flag beats the
config file. Through npm: `npm run marks:on -- --base main`.

After `on`: reload the page. After `off`: `git diff` must show only the real change — say so in the
report, with the command.

## The notes file (`--notes`)

A branch's diff is hundreds of lines and a commit subject is written for a developer. A notes file
is the list written for the reader: each item names the element that shows it by a piece of source
text found **exactly once** in its file; the badge carries the item's number, the panel its text.

```json
{
  "items": [
    { "n": 1, "note": "The save button now says what it saves.",
      "anchors": [{ "file": "src/screens/Profile.tsx", "find": "data-action=\"profile.save\"" }] },
    { "n": 2, "note": "Dates show as day/month/year.",
      "anchors": [
        { "file": "src/screens/CaseList.tsx", "find": "<td className=\"opened\">" },
        { "file": "src/screens/CaseHeader.tsx", "find": "{formatDate(openedAt)}" }
      ] },
    { "n": 3, "note": "Mail is retried three times.", "offScreen": "server only — nothing on a page" }
  ]
}
```

- `n` whole number, `note` non-empty and without ` · ` (the panel's separator). `file` is relative
  to the project folder and has one of the configured extensions.
- An item with no anchors must say why in `offScreen`; it is listed, not drawn.
- Every anchor that is missing, found twice, inside a comment, or inside no plain HTML element is a
  failure, and **nothing is written**. Two items on one element share its badge (first item's number).

## What it refuses, and says so

- **A prop of a component** (`<Action label={…}>`): a component keeps only the props it names, so a
  `data-change` put on it never reaches the DOM. When a plain element encloses the component, that
  element is outlined; when none does, the change is listed as "a prop of <Action>", not drawn.
- **A rewritten comment**: changes no pixel; listed as "a comment", never outlined.
- **Already marked**, a tag that never closes, a stylesheet block or overlay import that is not
  where `on` left it, an anchor that does not resolve — the run stops and names it.
- **A failing `check`** after marking: the marks are taken back out and the run exits 1.
- **New files git does not track** have no diff, so they are listed, not marked.
  `git add -N <file>` puts their lines in the diff (every line is then a change).

## Limits

- Only plain lower-case elements are outlined; changes in logic, imports and props of components
  are listed, not drawn. In diff mode an element is found only when its tag opens a line; `--notes`
  finds elements opening anywhere on a line.
- `.html` comments are `<!-- -->`; JSX comments are `//`, `/* */`, `{/* */}`. Nothing else is parsed:
  a `<` inside a `<script>` or `<style>` of an HTML page can be taken for a tag.
- The source is changed on disk, so every other process watching the folder (a dev server, another
  session, a test run) sees the marks too. Do not run `on` in a checkout someone else is using
  without asking, and never leave it on: `off` before you stop.
- **Marks are never committed.** `git diff` after `off` is the proof.
