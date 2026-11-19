// What a run is told: the command line first, then `change-marks.config.json` in the project,
// then the defaults below. Anything a run cannot work without and was not told is refused here,
// by name, before a file is read.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPT_FOLDER = dirname(dirname(fileURLToPath(import.meta.url)));
export const CONFIG_NAME = 'change-marks.config.json';

const DEFAULTS = {
  base: 'HEAD',
  source: 'src',
  extensions: ['.tsx', '.jsx', '.html'],
  stylesheet: null,
  entry: null,
  overlayFile: null,
  appRootId: 'root',
  componentsThatReachTheDom: [],
  check: null,
  howToRun: null,
  labels: {
    notCommitted: 'Not committed yet',
    panelHeading: 'What changed here · mark ',
    badgeHint: 'Click to see what changed here',
  },
};

// Each of these swallows the word after it. Without this, `-- --base <ref>` takes <ref> for the
// command and refuses with "unknown command".
const TAKES_A_VALUE = new Set(['--base', '--source', '--notes', '--project', '--config', '--stylesheet', '--entry']);

const toNative = (path) => (path == null ? path : String(path).split('/').join(sep));

export function readSettings(argv) {
  const positional = argv.filter((word, at) => !word.startsWith('--') && !TAKES_A_VALUE.has(argv[at - 1]));
  const flag = (name) => {
    const at = argv.indexOf(`--${name}`);
    return at === -1 ? undefined : argv[at + 1];
  };

  const project = resolve(flag('project') ?? process.cwd());
  if (!existsSync(project)) fail(`the project folder ${project} does not exist.`);
  const configPath = flag('config') ? resolve(flag('config')) : join(project, CONFIG_NAME);
  let fromFile = {};
  if (existsSync(configPath)) {
    try {
      fromFile = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (error) {
      fail(`${configPath} is not valid JSON: ${error.message}`);
    }
  } else if (flag('config')) fail(`the config file ${configPath} does not exist.`);

  const picked = (name) => flag(name) ?? fromFile[name] ?? DEFAULTS[name];
  const settings = {
    command: positional[0] ?? 'list',
    project,
    configPath: existsSync(configPath) ? configPath : null,
    base: picked('base'),
    source: toNative(picked('source')),
    extensions: (fromFile.extensions ?? DEFAULTS.extensions).map((e) => e.toLowerCase()),
    stylesheet: toNative(picked('stylesheet')),
    entry: toNative(picked('entry')),
    overlayFile: toNative(fromFile.overlayFile ?? null),
    appRootId: fromFile.appRootId ?? DEFAULTS.appRootId,
    componentsThatReachTheDom: fromFile.componentsThatReachTheDom ?? DEFAULTS.componentsThatReachTheDom,
    check: argv.includes('--no-check') ? null : (fromFile.check ?? DEFAULTS.check),
    checkSkipped: argv.includes('--no-check'),
    notes: flag('notes') ? resolve(flag('notes')) : null,
    labels: { ...DEFAULTS.labels, ...(fromFile.labels ?? {}) },
    howToRun: fromFile.howToRun ?? `node "${join(SCRIPT_FOLDER, 'change-marks.mjs')}"`,
  };

  if (settings.check != null && (!Array.isArray(settings.check) || !settings.check.length)) {
    fail('"check" must be a command as a list of words, e.g. ["npx", "tsc", "--noEmit"], or null.');
  }
  const reaching = settings.componentsThatReachTheDom;
  if (!Array.isArray(reaching) || reaching.some((name) => typeof name !== 'string' || !/^[A-Z][A-Za-z0-9]*$/.test(name))) {
    fail('"componentsThatReachTheDom" must be a list of capitalised component names, e.g. ["Box", "Stack", "Chip"].');
  }
  if (settings.entry && !settings.overlayFile && !isHtml(settings.entry)) {
    // The overlay module sits beside the entry and has the entry's language, so a TypeScript
    // entry imports a .ts file and a JavaScript one a .js file.
    const extension = /\.tsx?$/i.test(settings.entry) ? '.ts' : '.js';
    settings.overlayFile = join(dirname(settings.entry), `change-marks-overlay${extension}`);
  }
  return settings;
}

export const isHtml = (path) => /\.html?$/i.test(path);

/** `on` and `off` write into the stylesheet and the entry; without both they cannot keep their promise. */
export function requireWritingTargets(settings) {
  const missing = [];
  if (!settings.stylesheet) missing.push('"stylesheet" (the .css or .html file the outline block is appended to)');
  if (!settings.entry) missing.push('"entry" (the module or .html page that loads the badge overlay)');
  if (missing.length) {
    fail(
      `not told where to write: ${missing.join(' and ')}. Put them in ${join(settings.project, CONFIG_NAME)} ` +
        'or pass --stylesheet / --entry.',
    );
  }
  for (const path of [settings.stylesheet, settings.entry]) {
    if (!existsSync(path)) fail(`${path} does not exist (paths are relative to ${settings.project}).`);
  }
  if (!isHtml(settings.entry) && !['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(extname(settings.entry))) {
    fail(`the entry ${settings.entry} is neither a script module nor an .html page.`);
  }
}

export function fail(message) {
  console.error(`[marks] ${message}`);
  process.exit(1);
}
