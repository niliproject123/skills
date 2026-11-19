// Which elements get a mark, and what each mark says — read off `git diff` (the default) or off a
// notes file a person wrote for the reader (`--notes`). Nothing here writes a file.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  commentedLines,
  componentExtents,
  elementExtents,
  elementExtentsAnywhere,
  innermost,
  isCommentLine,
  kindOf,
  lineIndexOf,
  shorten,
} from './source.mjs';

export const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const toNative = (path) => path.split('/').join(sep);
export const shownPath = (path) => relative(process.cwd(), path).split(sep).join('/');

export function isUiSource(settings, path) {
  const lower = path.toLowerCase();
  return settings.extensions.some((extension) => lower.endsWith(extension));
}

export function uiFilesUnder(settings, dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...uiFilesUnder(settings, path));
    else if (isUiSource(settings, path)) out.push(path);
  }
  return out;
}

/** Every file carrying a `data-change`, so `on` can refuse and `off` knows where to look. */
export function markedFiles(settings) {
  return uiFilesUnder(settings, settings.source)
    .sort()
    .filter((path) => readFileSync(path, 'utf8').includes('data-change='));
}

/**
 * The changed lines of one file, each with the text that arrived and the text it replaced.
 * `git diff -U0` gives exactly the changed lines and no context around them.
 */
function changedLines(settings, path) {
  const patch = git(['diff', '-U0', settings.base, '--', path]);
  const changes = [];
  let nextLine = 0;
  let removed = [];
  let addedInHunk = 0;
  for (const line of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(line);
    if (hunk) {
      nextLine = Number(hunk[1]);
      removed = [];
      addedInHunk = 0;
      continue;
    }
    if (!nextLine) continue;
    if (line.startsWith('---') || line.startsWith('+++')) continue;
    if (line.startsWith('-')) removed.push(line.slice(1).trim());
    else if (line.startsWith('+')) {
      changes.push({ line: nextLine + addedInHunk, now: line.slice(1).trim(), was: removed[addedInHunk] ?? '' });
      addedInHunk += 1;
    }
  }
  return changes;
}

/**
 * What a change was FOR, in the words of whoever made it — the subject line of the commit the
 * line belongs to, read with `git blame`. A line not committed yet says exactly that.
 */
const subjectOfCommit = new Map();
function commitSubject(sha) {
  if (!subjectOfCommit.has(sha)) subjectOfCommit.set(sha, git(['log', '-1', '--format=%s', sha]).trim());
  return subjectOfCommit.get(sha);
}

function reasonsByLine(settings, path) {
  const reasons = new Map();
  let blame;
  try {
    blame = git(['blame', '--porcelain', '--', path]);
  } catch {
    // A file not in the index has no blame; the caller says "not committed" for every line.
    return reasons;
  }
  let sha = null;
  let lineNumber = 0;
  for (const line of blame.split('\n')) {
    const header = /^([0-9a-f]{40}) [0-9]+ ([0-9]+)/.exec(line);
    if (header) {
      sha = header[1];
      lineNumber = Number(header[2]);
      continue;
    }
    if (sha && line.startsWith('\t')) {
      reasons.set(lineNumber, /^0+$/.test(sha) ? settings.labels.notCommitted : commitSubject(sha));
      sha = null;
    }
  }
  return reasons;
}

/**
 * New files git does not track yet. `git diff` says nothing about them, so they get no marks; they
 * are named in the output instead (`git add -N <file>` makes their lines part of the diff).
 */
export function untrackedUiFiles(settings) {
  return git(['ls-files', '--others', '--exclude-standard', '--', settings.source])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(toNative)
    .filter((path) => isUiSource(settings, path))
    .sort();
}

/** Which UI files differ from the base. `--relative` keeps paths relative to the project folder. */
function touchedUiFiles(settings) {
  return git(['diff', '--name-only', '--relative', settings.base, '--', settings.source])
    .split('\n')
    .map((line) => toNative(line.trim()))
    .filter((path) => path && isUiSource(settings, path) && existsSync(path))
    .sort();
}

/** One mark per element, however many changed lines landed inside it. */
function planFile(settings, path, counter) {
  const kind = kindOf(path);
  const source = readFileSync(path, 'utf8');
  const lines = source.split('\n');
  const commented = commentedLines(source, kind);
  const reaching = kind === 'jsx' ? settings.componentsThatReachTheDom : [];
  const { extents, offsets } = elementExtents(source, commented, reaching);
  const { extents: components } = componentExtents(source, commented);
  const shown = shownPath(path);

  const byElement = new Map();
  const unreachable = [];
  for (const change of changedLines(settings, path)) {
    // A rewritten comment changes no pixel. Marking one puts a red box round a paragraph whose
    // text nobody altered, which is the fastest way to make a reviewer stop trusting the marks.
    if (!change.now || commented[change.line - 1] || isCommentLine(change.now, kind)) {
      if (change.now) unreachable.push({ ...change, file: shown, comment: true });
      continue;
    }
    // Probe at the line's first real character, so an element is found by its own opening line too.
    const indent = /^[ \t]*/.exec(lines[change.line - 1] ?? '')[0].length;
    const element = innermost(extents, offsets[change.line - 1] + indent);
    if (!element) {
      const inside = innermost(components, offsets[change.line - 1] + indent)?.tag ?? null;
      unreachable.push({ ...change, file: shown, inside });
      continue;
    }
    if (!byElement.has(element.line)) byElement.set(element.line, { element, changes: [] });
    byElement.get(element.line).changes.push(change);
  }

  const marks = [];
  const reasons = reasonsByLine(settings, path);
  for (const [, { element, changes }] of [...byElement].sort((a, b) => a[0] - b[0])) {
    const number = (counter.next += 1);
    // One element can hold lines from several commits. Each reason is said once, in line order.
    const said = [];
    for (const change of changes) {
      const reason = reasons.get(change.line) ?? settings.labels.notCommitted;
      if (!said.includes(reason)) said.push(reason);
    }
    marks.push({
      file: path,
      shown,
      element,
      lines: changes.map((c) => c.line),
      number,
      reasons: said,
      where: `${shown}:${changes[0].line}`,
      note: shorten(said.join(' · '), 400),
    });
  }
  return { source, marks, unreachable };
}

/**
 * The marks a person listed (`--notes`). Every anchor must be found exactly once and inside a plain
 * HTML element — the same element the diff mode would outline — or it is a failure, named, and
 * nothing is written. Two items that land on one element share its badge, which carries the first
 * item's number, and the panel lists each item with its own.
 */
function planFromNotes(settings) {
  let listed;
  try {
    listed = JSON.parse(readFileSync(settings.notes, 'utf8'));
  } catch (error) {
    console.error(`[marks] cannot read ${settings.notes}: ${error.message}`);
    process.exit(1);
  }
  if (!Array.isArray(listed.items)) {
    console.error(`[marks] ${settings.notes} has no "items" list.`);
    process.exit(1);
  }
  const failures = [];
  const offScreen = [];
  const read = new Map();
  const readOnce = (path) => {
    if (!read.has(path)) {
      const kind = kindOf(path);
      const source = readFileSync(path, 'utf8');
      const commented = commentedLines(source, kind);
      read.set(path, { source, commented, ...elementExtentsAnywhere(source, commented, kind, settings.componentsThatReachTheDom), byElement: new Map() });
    }
    return read.get(path);
  };

  for (const item of listed.items) {
    const anchors = item.anchors ?? [];
    if (!Number.isInteger(item.n) || typeof item.note !== 'string' || !item.note.trim()) {
      failures.push(`${JSON.stringify(item).slice(0, 80)}: an item needs a whole "n" and a "note"`);
      continue;
    }
    if (item.note.includes(' · ')) {
      failures.push(`${item.n}: the note holds " · ", which the panel reads as a separator`);
      continue;
    }
    if (!anchors.length) {
      offScreen.push(item);
      continue;
    }
    for (const anchor of anchors) {
      const label = `${item.n}. ${anchor.file} — ${JSON.stringify(anchor.find)}`;
      const path = toNative(String(anchor.file ?? ''));
      if (!anchor.find || !existsSync(path) || !isUiSource(settings, path)) {
        failures.push(`${label}: needs an existing "file" (${settings.extensions.join(' / ')}) and a "find"`);
        continue;
      }
      const file = readOnce(path);
      const found = [];
      for (let at = file.source.indexOf(anchor.find); at !== -1; at = file.source.indexOf(anchor.find, at + 1)) {
        found.push(at);
      }
      if (found.length !== 1) {
        failures.push(`${label}: found ${found.length} times — it must be found exactly once`);
        continue;
      }
      if (file.commented[lineIndexOf(file.offsets, found[0])]) {
        failures.push(`${label}: inside a comment`);
        continue;
      }
      const element = innermost(file.extents, found[0]);
      if (!element) {
        failures.push(`${label}: inside no plain HTML element and no component listed in "componentsThatReachTheDom"`);
        continue;
      }
      // Keyed by where the element opens, not its line: two elements can open on one line.
      if (!file.byElement.has(element.start)) file.byElement.set(element.start, { element, items: [] });
      const onElement = file.byElement.get(element.start).items;
      if (!onElement.includes(item)) onElement.push(item);
    }
  }

  const all = [];
  for (const [path, file] of [...read].sort((a, b) => a[0].localeCompare(b[0]))) {
    const shown = shownPath(path);
    const marks = [...file.byElement.values()]
      .sort((a, b) => a.element.start - b.element.start)
      .map(({ element, items }) => ({
        file: path,
        shown,
        element,
        number: items[0].n,
        where: `${shown}:${element.line}`,
        note: items.length === 1 ? items[0].note : items.map((item) => `${item.n}. ${item.note}`).join(' · '),
      }));
    all.push({ path, source: file.source, marks });
  }
  return { all, unreachable: [], untracked: [], failures, offScreen };
}

export function plan(settings) {
  if (settings.notes) return planFromNotes(settings);
  const counter = { next: 0 };
  const all = [];
  const unreachable = [];
  for (const path of touchedUiFiles(settings)) {
    const one = planFile(settings, path, counter);
    all.push({ path, ...one });
    unreachable.push(...one.unreachable);
  }
  return { all, unreachable, untracked: untrackedUiFiles(settings) };
}
