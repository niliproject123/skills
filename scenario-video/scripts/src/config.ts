// The project's answers to the first-use questionnaire, kept in `.claude/scenario-video.config.json`
// at the repository root and reused by every later recording. The skill writes it once, with the
// person; these tools only read it, and refuse a file that is missing a field rather than guess one.
//
// Passwords are never in the file: each person names the environment variable that holds theirs.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { VideoError } from './errors';
import type { CaptionWords } from './captions';
import type { Colours } from './overlay';

export const SETTINGS_FOLDER = '.claude';
export const SETTINGS_FILE_NAME = 'scenario-video.config.json';
/** Set by `make.ts` for the scenario it runs, so the runtime reads the same file without searching. */
export const SETTINGS_FILE_VARIABLE = 'VIDEO_SETTINGS_FILE';

export interface Person {
  /** How the scenario, the plan and the video name them: `Dana`, `דנה — מנהלת`. */
  name: string;
  /** What they sign in with. Absent when `signIn.method` is `none`. */
  username?: string;
  /** The environment variable holding their password — never the password itself. */
  passwordVariable?: string;
}

export interface FormSignIn {
  method: 'form';
  /** The sign-in page, relative to the app address: `/login`. */
  page: string;
  usernameField: string;
  passwordField: string;
  submit: string;
  /** A selector that is visible once the person is signed in — what the runtime waits on. */
  signedInWhen: string;
}

export interface TokenSignIn {
  method: 'token';
  /** The sign-in call. `{username}` and `{password}` in the body are replaced per person. */
  request: { address: string; method: string; body: Record<string, string> };
  /** Where the token is in the answer, as a dotted path: `data.token`. */
  tokenAt: string;
  /** Where the app keeps it — written into every page before any app script runs. */
  keep: { where: 'localStorage' | 'sessionStorage' | 'cookie'; name: string };
}

export type SignIn = { method: 'none' } | FormSignIn | TokenSignIn;

export interface VideoSettings {
  app: {
    /** Where the app is opened: `http://localhost:5173`. `APP_ADDRESS` overrides it for one run. */
    address: string;
    /** Answered 2xx when the app is up; checked before every recording. */
    healthCheck: string;
    /** How a person starts it — printed when the health check fails. The tools never start it. */
    startCommand: string;
    /** Other addresses that are the app's own (an api on another port) — their 4xx/5xx count as errors. */
    otherAddresses: string[];
  };
  signIn: SignIn;
  people: Person[];
  /** The seed run before each recording, `{runId}` replaced; null when the scenario needs no data. */
  seed: { command: string } | null;
  locators: { testIdAttribute: string | null };
  folders: { scenarios: string; tools: string; output: string };
  captions: { language: string; direction: 'rtl' | 'ltr'; words?: Partial<CaptionWords> };
  videoShape: 'per-person' | 'per-scenario';
  branding: { logo: string | null; font: string | null; colours: Partial<Colours> };
  masking: { fields: string[]; patterns: ('email' | 'phone')[] };
  viewport: { width: number; height: number };
}

export interface LoadedSettings {
  settings: VideoSettings;
  /** The repository root — the folder holding `.claude/`. Every relative folder is from here. */
  root: string;
  file: string;
}

/** Walks up from `from` to the first folder with `.claude/scenario-video.config.json`. */
export function findSettingsFile(from: string): string {
  const named = process.env[SETTINGS_FILE_VARIABLE];
  if (named) {
    if (!existsSync(named)) throw new VideoError('settings.named_file_missing', `${SETTINGS_FILE_VARIABLE} names ${named}, which does not exist`);
    return resolve(named);
  }
  let folder = resolve(from);
  for (;;) {
    const candidate = join(folder, SETTINGS_FOLDER, SETTINGS_FILE_NAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(folder);
    if (parent === folder) break;
    folder = parent;
  }
  throw new VideoError(
    'settings.not_found',
    `no ${SETTINGS_FOLDER}/${SETTINGS_FILE_NAME} in ${resolve(from)} or any folder above it — run the scenario-video skill once in this repository; its first-use questionnaire writes that file`,
  );
}

// --- reading, field by field: a wrong field is named with its path ------------------------------

type Raw = Record<string, unknown>;

function bad(path: string, wanted: string, got: unknown): never {
  throw new VideoError('settings.bad_field', `${path} must be ${wanted} (got ${JSON.stringify(got)})`, { path });
}
function objectAt(raw: Raw, key: string, path: string): Raw {
  const value = raw[key];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) bad(`${path}.${key}`, 'an object', value);
  return value as Raw;
}
function textAt(raw: Raw, key: string, path: string): string {
  const value = raw[key];
  if (typeof value !== 'string' || value.trim() === '') bad(`${path}.${key}`, 'a non-empty string', value);
  return value as string;
}
function textOrNullAt(raw: Raw, key: string, path: string): string | null {
  if (raw[key] === null) return null;
  return textAt(raw, key, path);
}
function textListAt(raw: Raw, key: string, path: string): string[] {
  const value = raw[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) bad(`${path}.${key}`, 'a list of strings', value);
  return value as string[];
}
function oneOf<T extends string>(raw: Raw, key: string, path: string, allowed: readonly T[]): T {
  const value = raw[key];
  if (typeof value !== 'string' || !allowed.includes(value as T)) bad(`${path}.${key}`, `one of ${allowed.join(' | ')}`, value);
  return value as T;
}
function numberAt(raw: Raw, key: string, path: string): number {
  const value = raw[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) bad(`${path}.${key}`, 'a positive number', value);
  return value as number;
}

function signInFrom(raw: Raw): SignIn {
  const method = oneOf(raw, 'method', 'signIn', ['none', 'form', 'token'] as const);
  if (method === 'none') return { method };
  if (method === 'form') {
    return {
      method,
      page: textAt(raw, 'page', 'signIn'),
      usernameField: textAt(raw, 'usernameField', 'signIn'),
      passwordField: textAt(raw, 'passwordField', 'signIn'),
      submit: textAt(raw, 'submit', 'signIn'),
      signedInWhen: textAt(raw, 'signedInWhen', 'signIn'),
    };
  }
  const request = objectAt(raw, 'request', 'signIn');
  const body = objectAt(request, 'body', 'signIn.request');
  for (const [key, value] of Object.entries(body)) if (typeof value !== 'string') bad(`signIn.request.body.${key}`, 'a string', value);
  const keep = objectAt(raw, 'keep', 'signIn');
  return {
    method,
    request: { address: textAt(request, 'address', 'signIn.request'), method: textAt(request, 'method', 'signIn.request'), body: body as Record<string, string> },
    tokenAt: textAt(raw, 'tokenAt', 'signIn'),
    keep: { where: oneOf(keep, 'where', 'signIn.keep', ['localStorage', 'sessionStorage', 'cookie'] as const), name: textAt(keep, 'name', 'signIn.keep') },
  };
}

export function readSettings(file: string): VideoSettings {
  let raw: Raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8')) as Raw;
  } catch (thrown) {
    throw new VideoError('settings.unreadable', `${file} is not readable JSON: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  }
  const app = objectAt(raw, 'app', 'settings');
  const signIn = signInFrom(objectAt(raw, 'signIn', 'settings'));
  const peopleRaw = raw['people'];
  if (!Array.isArray(peopleRaw) || peopleRaw.length === 0) bad('people', 'a non-empty list', peopleRaw);
  const people = (peopleRaw as Raw[]).map((person, index): Person => {
    const path = `people[${index}]`;
    const name = textAt(person, 'name', path);
    if (signIn.method === 'none') return { name };
    return { name, username: textAt(person, 'username', path), passwordVariable: textAt(person, 'passwordVariable', path) };
  });
  const seedRaw = raw['seed'];
  const seed = seedRaw === null ? null : { command: textAt(objectAt(raw, 'seed', 'settings'), 'command', 'seed') };
  const locators = objectAt(raw, 'locators', 'settings');
  const folders = objectAt(raw, 'folders', 'settings');
  const captions = objectAt(raw, 'captions', 'settings');
  const branding = objectAt(raw, 'branding', 'settings');
  const masking = objectAt(raw, 'masking', 'settings');
  const viewport = objectAt(raw, 'viewport', 'settings');
  const patterns = textListAt(masking, 'patterns', 'masking');
  for (const pattern of patterns) if (pattern !== 'email' && pattern !== 'phone') bad('masking.patterns', 'a list of "email" | "phone"', patterns);
  const words = captions['words'];
  return {
    app: {
      address: textAt(app, 'address', 'app'),
      healthCheck: textAt(app, 'healthCheck', 'app'),
      startCommand: textAt(app, 'startCommand', 'app'),
      otherAddresses: textListAt(app, 'otherAddresses', 'app'),
    },
    signIn,
    people,
    seed,
    locators: { testIdAttribute: textOrNullAt(locators, 'testIdAttribute', 'locators') },
    folders: { scenarios: textAt(folders, 'scenarios', 'folders'), tools: textAt(folders, 'tools', 'folders'), output: textAt(folders, 'output', 'folders') },
    captions: {
      language: textAt(captions, 'language', 'captions'),
      direction: oneOf(captions, 'direction', 'captions', ['rtl', 'ltr'] as const),
      ...(words === undefined ? {} : { words: objectAt(captions, 'words', 'captions') as Partial<CaptionWords> }),
    },
    videoShape: oneOf(raw, 'videoShape', 'settings', ['per-person', 'per-scenario'] as const),
    branding: {
      logo: textOrNullAt(branding, 'logo', 'branding'),
      font: textOrNullAt(branding, 'font', 'branding'),
      colours: objectAt(branding, 'colours', 'branding') as Partial<Colours>,
    },
    masking: { fields: textListAt(masking, 'fields', 'masking'), patterns: patterns as ('email' | 'phone')[] },
    viewport: { width: numberAt(viewport, 'width', 'viewport'), height: numberAt(viewport, 'height', 'viewport') },
  };
}

export function loadSettings(from: string = process.cwd()): LoadedSettings {
  const file = findSettingsFile(from);
  return { settings: readSettings(file), root: dirname(dirname(file)), file };
}

/** The address the app is opened at: `APP_ADDRESS` for one run, else the settings. */
export function appAddressOf(settings: VideoSettings): string {
  return (process.env['APP_ADDRESS'] ?? settings.app.address).replace(/\/+$/, '');
}

export function personNamed(settings: VideoSettings, name: string): Person {
  const found = settings.people.find((person) => person.name === name);
  if (!found) {
    throw new VideoError('settings.unknown_person', `nobody named "${name}" in the settings' people — known: ${settings.people.map((p) => p.name).join(' · ')}`);
  }
  return found;
}

/** The browser locale for the caption language: `he` → `he-IL`, `en` → `en-US`, anything else as written. */
export function localeOf(language: string): string {
  if (language === 'he') return 'he-IL';
  if (language === 'en') return 'en-US';
  if (language === 'ar') return 'ar';
  return language;
}
