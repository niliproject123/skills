// The two things `on` adds besides the attributes, and `off` takes back out byte for byte:
//   - the outline block, appended to the stylesheet (a .css file, or an .html page inside <style>)
//   - the badge overlay: a module copied beside the entry plus one import line at the entry's top,
//     or, when the entry is an .html page, the same code appended inline inside <script>.
//
// Both are appended or prepended whole and then sliced off by their exact length, never
// reformatted: a `trim()` here once cost a round-trip its byte-for-byte guarantee.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { SCRIPT_FOLDER, fail, isHtml } from './settings.mjs';

export const OPEN = '/* >>> change-marks — written by `change-marks on`. Do not edit; `change-marks off` removes it. */';
const CLOSE = '/* <<< change-marks */';
const OVERLAY_TEMPLATE = join(SCRIPT_FOLDER, 'overlay.js');
const SCRIPT_OPEN = '<script data-change-marks="overlay">';

const lineEnding = (text) => (text.includes('\r\n') ? '\r\n' : '\n');

const CSS = [
  '[data-change] {',
  // !important: a component library's own `outline: 0` (MUI ButtonBase: chips, tabs, buttons) is
  // as specific as this selector and injected later, so without it those marks draw no outline
  '  outline: 2px solid #d92c2c !important;',
  // inside the element's own box: a parent with overflow:hidden (MUI's tab strip) clips an outline
  // drawn outside it, and a clipped mark looks like no mark
  '  outline-offset: -2px !important;',
  '  position: relative;',
  '}',
  '[data-change]:hover {',
  '  outline-color: #ff6a6a !important;',
  '}',
  '/* the badges live in one fixed layer over the page: a mark can land on a <select> or an',
  '   <input>, and those render no children, so a badge inside one is invisible. */',
  '#change-marks-layer {',
  '  position: fixed;',
  '  inset: 0;',
  '  z-index: 2147483000;',
  '  pointer-events: none;',
  '}',
  '#change-marks-layer > * { pointer-events: auto; }',
  '.change-badge {',
  '  position: fixed;',
  '  min-width: 15px;',
  '  height: 15px;',
  '  padding: 0 3px;',
  '  border: 0;',
  '  border-radius: 8px;',
  '  background: #d92c2c;',
  '  color: #fff;',
  '  font: 700 10px/15px ui-monospace, monospace;',
  '  text-align: center;',
  '  direction: ltr;',
  '  cursor: pointer;',
  '}',
  '.change-badge:hover, .change-badge:focus-visible { background: #ff6a6a; }',
  '.change-badge[aria-expanded="true"] { background: #111; }',
  '/* the panel: what changed, in words, under the badge that opened it. */',
  '.change-panel {',
  '  position: fixed;',
  '  max-width: min(420px, 80vw);',
  '  padding: 8px 10px;',
  '  border: 1px solid #d92c2c;',
  '  border-radius: 6px;',
  '  background: #fff;',
  '  color: #111;',
  '  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);',
  '  font: 400 12px/1.5 inherit;',
  '  text-align: start;',
  '  white-space: normal;',
  '}',
  '.change-panel__what { display: block; font-weight: 700; margin-bottom: 4px; }',
  '.change-panel__reason { display: block; margin: 2px 0; }',
  '.change-panel__where { display: block; margin-top: 6px; opacity: 0.6; font-size: 11px; direction: ltr; }',
];

function stylesheetBlock(path, nl) {
  const lines = isHtml(path) ? ['<style>', OPEN, ...CSS, CLOSE, '</style>'] : [OPEN, ...CSS, CLOSE];
  return nl + lines.join(nl) + nl;
}

export const stylesheetIsPainted = (settings) => readFileSync(settings.stylesheet, 'utf8').includes(OPEN);

export function paintStylesheet(settings, add) {
  const path = settings.stylesheet;
  const source = readFileSync(path, 'utf8');
  const block = stylesheetBlock(path, lineEnding(source));
  const without = source.endsWith(block) ? source.slice(0, -block.length) : source;
  if (!add && without === source && source.includes(OPEN)) {
    fail(`the block in ${path} is not where it was left (the file's end). Remove it by hand.`);
  }
  writeFileSync(path, add ? without + block : without, 'utf8');
}

/** The overlay's code, with this project's labels and app root written in. */
function overlayCode(settings) {
  return readFileSync(OVERLAY_TEMPLATE, 'utf8')
    .replace('__CHANGE_MARKS_LABELS__', JSON.stringify(settings.labels))
    .replace('__CHANGE_MARKS_APP_ROOT__', JSON.stringify(settings.appRootId));
}

function importLine(settings) {
  const name = basename(settings.overlayFile).replace(/\.(ts|js)$/, '');
  const extension = settings.overlayFile.endsWith('.js') ? '.js' : '';
  return `import './${name}${extension}';`;
}

export function paintOverlay(settings, add) {
  const entry = readFileSync(settings.entry, 'utf8');
  const nl = lineEnding(entry);

  if (isHtml(settings.entry)) {
    const block = nl + SCRIPT_OPEN + nl + overlayCode(settings).split(/\r?\n/).join(nl) + '</script>' + nl;
    if (add) {
      if (entry.includes(SCRIPT_OPEN)) fail(`${settings.entry} already holds the overlay. Run \`off\` first.`);
      writeFileSync(settings.entry, entry + block, 'utf8');
    } else if (entry.endsWith(block)) writeFileSync(settings.entry, entry.slice(0, -block.length), 'utf8');
    else if (entry.includes(SCRIPT_OPEN)) {
      fail(`the overlay <script> in ${settings.entry} is not where it was left. Remove it by hand.`);
    }
    return;
  }

  const importText = importLine(settings);
  const line = `${importText}${nl}`;
  if (add) {
    if (entry.includes(importText)) fail(`${settings.entry} already imports the overlay. Run \`off\` first.`);
    if (existsSync(settings.overlayFile)) {
      fail(`${settings.overlayFile} already exists and is not this run's. Move it or run \`off\` first.`);
    }
    // `export {}` makes the copy a module, which an isolated-modules TypeScript build requires.
    writeFileSync(settings.overlayFile, `${overlayCode(settings)}export {};\n`, 'utf8');
    writeFileSync(settings.entry, line + entry, 'utf8');
    return;
  }
  if (entry.startsWith(line)) writeFileSync(settings.entry, entry.slice(line.length), 'utf8');
  else if (entry.includes(importText)) {
    fail(`the overlay import in ${settings.entry} is not where it was left. Remove it by hand.`);
  }
  if (existsSync(settings.overlayFile)) rmSync(settings.overlayFile);
}

export function overlayIsPainted(settings) {
  if (isHtml(settings.entry)) return readFileSync(settings.entry, 'utf8').includes(SCRIPT_OPEN);
  return existsSync(settings.overlayFile) || readFileSync(settings.entry, 'utf8').includes(importLine(settings));
}
