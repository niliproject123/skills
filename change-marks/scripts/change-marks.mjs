#!/usr/bin/env node
// change-marks — show, in the browser, what a change touched. By changing the code, then
// taking the change back out.
//
//   node change-marks.mjs [list]     what is marked now, or what marking would mark
//   node change-marks.mjs on         write the marks into the UI source files
//   node change-marks.mjs off        take them out again, byte for byte
//
// Flags: --project <dir>      the project folder (default: the current folder); git runs there
//        --config <file>      default <project>/change-marks.config.json
//        --base <ref>         default HEAD — use the branch point to mark a whole branch
//        --source <dir>       the folder whose UI files are read (default src)
//        --stylesheet <file>  the .css or .html the outline block is appended to
//        --entry <file>       the module (main.tsx …) or .html page that loads the badge overlay
//        --no-check           skip the configured check that would undo a marking that breaks the build
//        --notes <file.json>  mark what a person listed instead of what `git diff` says
//
// Two rules this script keeps:
//   1. It refuses rather than guesses. Already marked, a tag it cannot read, a check that fails —
//      it says so and leaves the tree in a state you can name.
//   2. `on` then `off` returns every file to what it was. Prove it with `git diff` after `off`.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readSettings, requireWritingTargets, fail } from './lib/settings.mjs';
import { plan, markedFiles, shownPath } from './lib/plan.mjs';
import { escapeAttribute, unescapeAttribute, openingTagEnd, shorten } from './lib/source.mjs';
import { paintStylesheet, paintOverlay, stylesheetIsPainted, overlayIsPainted } from './lib/paint.mjs';

const settings = readSettings(process.argv.slice(2));
process.chdir(settings.project);
const RUN = settings.howToRun;

if (!existsSync(settings.source)) fail(`the source folder ${settings.source} does not exist in ${settings.project}.`);
try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'pipe' });
} catch {
  fail(`${settings.project} is not inside a git repository — the marks are read off \`git diff\`.`);
}

/** What `--notes` could not mark: failures stop the run, the off-screen items are only named. */
function reportNotes({ failures, offScreen }) {
  if (offScreen.length) {
    console.log(`[marks] ${offScreen.length} listed item(s) show on no screen, so nothing outlines them:`);
    for (const item of offScreen) console.log(`  ${String(item.n).padStart(3)}. ${item.note} — ${item.offScreen ?? 'no reason given'}`);
  }
  if (failures.length) {
    console.error(`[marks] ${failures.length} anchor(s) did not resolve. Nothing was written:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
}

function reportUnreachable(unreachable, untracked = []) {
  if (untracked.length) {
    console.log(`[marks] ${untracked.length} new file(s) git does not track yet are NOT marked (\`git add -N <file>\` puts their lines in the diff):`);
    for (const path of untracked.slice(0, 12)) console.log(`  ${path.split('\\').join('/')}`);
  }
  if (!unreachable.length) return;
  const comments = unreachable.filter((change) => change.comment);
  const inComponent = unreachable.filter((change) => change.inside);
  console.log(`[marks] ${unreachable.length} changed line(s) are NOT marked:`);
  for (const change of unreachable.slice(0, 12)) {
    const why = change.comment ? ' (a comment)' : change.inside ? ` (a prop of <${change.inside}>)` : ' (inside no HTML element)';
    console.log(`  ${change.file}:${change.line}${why} — ${shorten(change.now, 100)}`);
  }
  if (unreachable.length > 12) console.log(`  … and ${unreachable.length - 12} more`);
  if (comments.length) console.log(`[marks] ${comments.length} of them are comments — a rewritten comment changes nothing on the page.`);
  if (inComponent.length) {
    console.log(
      `[marks] ${inComponent.length} of them are props of a component, which is a change you WILL see and this ` +
        'tool cannot outline: a component keeps the props it names, so an attribute put on one never reaches the DOM.',
    );
  }
}

function on() {
  requireWritingTargets(settings);
  const already = markedFiles(settings);
  if (already.length || stylesheetIsPainted(settings) || overlayIsPainted(settings)) {
    fail(`already marked (${already.length} file(s), or the stylesheet block / overlay is in place). Run \`${RUN} off\` first.`);
  }
  const planned = plan(settings);
  const { all, unreachable, untracked } = planned;
  // A listed anchor that does not resolve stops the run before any file is touched.
  if (settings.notes) reportNotes(planned);

  // Every opening tag is checked before the first file is written, so a refusal leaves nothing behind.
  const edits = [];
  let total = 0;
  for (const file of all) {
    if (!file.marks.length) continue;
    const offsets = [0];
    for (const line of file.source.split('\n')) offsets.push(offsets[offsets.length - 1] + line.length + 1);
    const insertions = [];
    for (const mark of file.marks) {
      const start = offsets[mark.element.line - 1] + mark.element.column;
      if (openingTagEnd(file.source, start) === -1) {
        fail(`${mark.shown}:${mark.element.line} — the <${mark.element.tag}> tag never closes. Nothing was written.`);
      }
      insertions.push({
        at: start + 1 + mark.element.tag.length,
        text: ` data-change="${mark.number}" data-change-note="${escapeAttribute(mark.note)}" data-change-where="${escapeAttribute(mark.where)}"`,
      });
      total += 1;
    }
    let source = file.source;
    for (const insertion of insertions.sort((a, b) => b.at - a.at)) {
      source = source.slice(0, insertion.at) + insertion.text + source.slice(insertion.at);
    }
    edits.push({ path: file.path, source });
  }

  if (!total) {
    console.log(`[marks] nothing to mark — no ${settings.extensions.join(' / ')} file under ${settings.source} differs from ${settings.base} inside an HTML element.`);
    reportUnreachable(unreachable, untracked);
    return;
  }
  for (const edit of edits) writeFileSync(edit.path, edit.source, 'utf8');
  paintStylesheet(settings, true);
  paintOverlay(settings, true);
  console.log(`[marks] ${total} mark(s) in ${edits.length} file(s), ${settings.notes ? `from ${settings.notes}` : `against ${settings.base}`}.`);
  reportUnreachable(unreachable, untracked);
  checkOrUndo();
  console.log('[marks] reload the page. A red outline is a change; click its number for what changed and why.');
}

/** The configured build check is the only honest proof the insertions did not break the source. */
function checkOrUndo() {
  if (!settings.check) {
    console.log(
      settings.checkSkipped
        ? '[marks] --no-check: the marked source was NOT checked to still build.'
        : '[marks] no "check" command configured: the marked source was NOT checked to still build.',
    );
    return;
  }
  const [program, ...args] = settings.check;
  try {
    execFileSync(program, args, { encoding: 'utf8', stdio: 'pipe', shell: process.platform === 'win32' });
    console.log(`[marks] check clean (${settings.check.join(' ')}) — the marked source still builds.`);
  } catch (error) {
    console.error(`[marks] the marked source does NOT pass \`${settings.check.join(' ')}\`. Taking the marks back out.`);
    console.error(String(error.stdout || error.stderr || error.message).slice(0, 4000));
    off();
    process.exit(1);
  }
}

function off() {
  requireWritingTargets(settings);
  const files = markedFiles(settings);
  const stripped = [];
  for (const path of files) {
    let source = readFileSync(path, 'utf8');
    source = source.replace(/ data-change="\d+"/g, '');
    source = source.replace(/ data-change-note="[^"]*"/g, '');
    source = source.replace(/ data-change-where="[^"]*"/g, '');
    // An attribute left behind, not the words `[data-change]` — those are in the outline block
    // and the overlay, which sit in the same file when the entry is an .html page.
    if (/\bdata-change(?:-note|-where)?\s*=/.test(source)) {
      fail(`${path} still mentions data-change after stripping. Nothing was removed from any file — read it by hand.`);
    }
    stripped.push({ path, source });
  }
  for (const { path, source } of stripped) writeFileSync(path, source, 'utf8');
  // The overlay first: when the stylesheet and the entry are one .html page, its block is the last.
  const hadOverlay = overlayIsPainted(settings);
  paintOverlay(settings, false);
  const hadStyles = stylesheetIsPainted(settings);
  if (hadStyles) paintStylesheet(settings, false);
  if (!files.length && !hadStyles && !hadOverlay) {
    console.log('[marks] nothing was marked.');
    return;
  }
  console.log(
    `[marks] removed the marks from ${files.length} file(s)${hadStyles ? ', the stylesheet block' : ''}${hadOverlay ? ' and the overlay' : ''}.`,
  );
  console.log('[marks] `git diff` now shows your changes and nothing of this tool.');
}

function list() {
  const marked = markedFiles(settings);
  if (marked.length) {
    console.log(`[marks] ON — ${marked.length} file(s) carry marks.\n`);
    for (const path of marked) {
      const notes = [...readFileSync(path, 'utf8').matchAll(/data-change="(\d+)" data-change-note="([^"]*)"/g)];
      console.log(shownPath(path));
      for (const [, number, note] of notes) console.log(`  ${String(number).padStart(3)}. ${unescapeAttribute(note)}`);
    }
    console.log(`\nTake them out with \`${RUN} off\`.`);
    return;
  }
  const planned = plan(settings);
  const { all, unreachable, untracked } = planned;
  const marks = all.flatMap((file) => file.marks);
  if (settings.notes) {
    console.log(`[marks] OFF — \`${RUN} on --notes ${settings.notes}\` would write ${marks.length} mark(s):\n`);
    for (const mark of marks) console.log(`  ${String(mark.number).padStart(3)}. ${mark.where} <${mark.element.tag}> — ${mark.note}`);
    console.log('');
    reportNotes(planned);
    return;
  }
  if (!marks.length) {
    console.log(`[marks] OFF — nothing under ${settings.source} differs from ${settings.base} inside an HTML element, so there is nothing to mark.`);
    reportUnreachable(unreachable, untracked);
    return;
  }
  console.log(`[marks] OFF — \`${RUN} on\` would write ${marks.length} mark(s) against ${settings.base}:\n`);
  let file = null;
  for (const mark of marks) {
    if (mark.shown !== file) {
      file = mark.shown;
      console.log(file);
    }
    console.log(`  ${String(mark.number).padStart(3)}. line ${mark.element.line} <${mark.element.tag}> — ${mark.note}`);
  }
  console.log('');
  reportUnreachable(unreachable, untracked);
}

if (settings.command === 'on') on();
else if (settings.command === 'off') off();
else if (settings.command === 'list') list();
else fail(`unknown command "${settings.command}". Use: list · on · off`);
