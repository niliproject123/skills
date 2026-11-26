---
name: screen-fit
description: Grade a running web page's layout by measurement, not by looking — every element's box at every route and viewport, checked for elements overlapping or crossing the screen edge, content spilling out of its card, controls clipped by a container, the share of empty space, buttons too small for a big screen, and modals or overlays that do not fit the viewport. Use when someone asks to check or fix layout, overlap, intersections, spacing, empty space, overflow, or whether a screen or dialog fits at a given size.
---

# screen-fit — layout geometry of a running page

Two scripts in `scripts/`, both open a real browser on a running app and measure with
`getBoundingClientRect`. No screenshots to judge by eye; each hit names the element and the pixels.

| script | grades | exit |
|---|---|---|
| `screen-fit.ts` | 1. nothing crosses nothing (viewport edge, overlap, spill past its card, clipped control) — must pass · 2. empty space, target 15%, pass 10–15% · 3. non-navbar buttons hold their share of the viewport | 0 pass · 1 fail · 2 void |
| `modal-fit.ts` | each overlay: the backdrop does not scroll, card top ≥ 0, card bottom ≤ viewport height | 0 pass · 1 fail · viewports default 320×568 … 932×430, `VIEWPORTS` to change |

```bash
cd c:/dev/skills/screen-fit/scripts
npm install                                   # first time
WEB_URL=http://localhost:5173 ROUTES=/,/lobby VIEWPORTS=laptop,big npx tsx screen-fit.ts
OUT_DIR=<discussion-folder>/reports/<nn>_screen-fit npx tsx screen-fit.ts
WEB_URL=http://localhost:5173 CASES=./cases.json npx tsx modal-fit.ts   # how to open each overlay: see cases.example.json
```

Before pointing it at a new app, read `README.md` (all settings): set the opaque list, or a drawing
surface reports every shape as an overlap; seed what the app needs in localStorage (a token) through
its env vars. The analyzers (`screen-fit-analyzers.ts`) know nothing about any app.

Mocked data: none — every rect is measured from the real page.
