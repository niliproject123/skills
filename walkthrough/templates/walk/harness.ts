// The run around the walk: settings read and refused before anything starts, the production guard, the
// seed, the browser and its one page, the four browser listeners, the log, the cleanup (green or red),
// the report and the exit code. The runner (`runner.ts`) walks the steps inside it.
//
// Environment:
//   WALK_MODE          stepped (default) — a person presses "Next"; auto — the runner presses it, end to end
//   WALK_START_STEP    a step number to start waiting from, without the list (stepped only)
//   WALK_HEADLESS      yes — no window (auto only: a stepped walk headless would wait for nobody)
//   WALK_RUN_ID        the run id; default walk-<date>-<time>-<4 letters>
//   WALK_KEEP_DATA     yes — skip the cleanup command (said in the log and the report)
//   WALK_APP_ADDRESS   overrides the config's appAddress for one run
//   each person's passwordVariable
// Any other value of these refuses to start, by name.
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Checks } from './checks';
import { overlayWords, type Dictionary } from './dictionary';
import { walkOverlayScript } from './overlay';
import { SCROLL_METER_SCRIPT } from './scroll-meter';
import { firstLineOf, WalkError, type Person, type WalkConfig } from './types';

export interface RunSettings {
  runId: string;
  mode: 'stepped' | 'auto';
  startStep: number | null;
  headed: boolean;
  keepData: boolean;
  appAddress: string;
  passwords: Record<string, string>;
}

const yesOrNo = (name: string): boolean => {
  const value = process.env[name]?.trim() ?? '';
  if (value === '' || value === 'no') return false;
  if (value === 'yes') return true;
  throw new WalkError('settings.bad_value', `${name} is "${value}" — yes or no`);
};

/** Every setting read and checked before the seed, the browser or anything else. */
export function readSettings(config: WalkConfig): RunSettings {
  const modeValue = process.env['WALK_MODE']?.trim() || 'stepped';
  if (modeValue !== 'stepped' && modeValue !== 'auto') throw new WalkError('settings.bad_value', `WALK_MODE is "${modeValue}" — stepped or auto`);
  const startValue = process.env['WALK_START_STEP']?.trim() ?? '';
  if (startValue !== '' && !/^[1-9][0-9]*$/.test(startValue)) throw new WalkError('settings.bad_value', `WALK_START_STEP is "${startValue}" — a step number, such as 5`);
  if (startValue !== '' && modeValue === 'auto') throw new WalkError('settings.contradict', 'WALK_START_STEP is set and WALK_MODE is auto — auto waits for no step; unset one of them');
  const headless = yesOrNo('WALK_HEADLESS');
  if (headless && modeValue === 'stepped') throw new WalkError('settings.contradict', 'WALK_HEADLESS=yes with a stepped walk — nobody could press Next; use WALK_MODE=auto');
  const appAddress = process.env['WALK_APP_ADDRESS']?.trim() || config.appAddress;
  const production = config.productionAddresses.find((address) => appAddress.startsWith(address));
  if (production && !config.allowProductionWrites) {
    throw new WalkError('settings.production', `${appAddress} is production (${production}) and the walk writes — refused. Only the brief, approved by the user, may set allowProductionWrites`);
  }
  const passwords: Record<string, string> = {};
  const missing: string[] = [];
  for (const person of config.people) {
    const value = process.env[person.passwordVariable];
    if (!value) missing.push(`${person.passwordVariable} (${person.name})`);
    else passwords[person.key] = value;
  }
  if (missing.length > 0) throw new WalkError('settings.no_password', `set these password variables: ${missing.join(', ')}`);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const runId = process.env['WALK_RUN_ID']?.trim() || `walk-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) throw new WalkError('settings.bad_value', `WALK_RUN_ID is "${runId}" — letters, digits, - and _ only (it goes into names and commands)`);
  return { runId, mode: modeValue, startStep: startValue === '' ? null : Number(startValue), headed: !headless, keepData: yesOrNo('WALK_KEEP_DATA'), appAddress, passwords };
}

/** The browser errors of the run, and the 4xx/5xx a step declared it expects. */
export class BrowserErrors {
  readonly lines: string[] = [];
  private step = 'before the first step';
  private readonly expected: { step: string; urlPart: string; status: number; why: string; matched: boolean }[] = [];

  constructor(private readonly origins: string[], private readonly log: (actor: string, message: string) => void) {}

  stepIs(step: string): void {
    this.step = step;
  }

  expect(match: { urlPart: string; status: number }, why: string): void {
    this.expected.push({ step: this.step, ...match, why, matched: false });
    this.log('errors', `step ${this.step} declares it expects ${match.status} from …${match.urlPart}: ${why}`);
  }

  /** The declared answers of `step` that never came. */
  unmatched(step: string): string[] {
    return this.expected.filter((one) => one.step === step && !one.matched).map((one) => `${one.status} from …${one.urlPart} (${one.why})`);
  }

  /**
   * Resolves once no request of the page is in flight. The walk calls it before it navigates by itself
   * (a step's goto, "Back"): leaving a page with a request open aborts it, and the abort is a failed request.
   */
  async quiet(what: string, ceilingMs = 15_000): Promise<void> {
    const deadline = Date.now() + ceilingMs;
    while (this.inFlight.size > 0) {
      if (Date.now() > deadline) {
        throw new WalkError('walk.never_quiet', `${what}: ${this.inFlight.size} request(s) still open after ${ceilingMs} ms — ${[...this.inFlight].slice(0, 3).join(' · ')}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100)); // polling an in-memory count, not waiting on the app blindly
    }
  }

  private readonly inFlight = new Set<string>();

  listen(page: Page): void {
    let counter = 0;
    const open = new WeakMap<object, string>();
    page.on('request', (request) => {
      counter += 1;
      const tag = `${counter} ${request.method()} ${request.url()}`;
      open.set(request, tag);
      this.inFlight.add(tag);
    });
    const close = (request: object): void => {
      const tag = open.get(request);
      if (tag) this.inFlight.delete(tag);
    };
    page.on('requestfinished', close);
    page.on('requestfailed', close);
    const saw = (kind: string, line: string): void => {
      const full = `step ${this.step} · ${kind}: ${line}`;
      this.lines.push(full);
      this.log('errors', full);
    };
    page.on('console', (message) => { if (message.type() === 'error') saw('console error', message.text()); });
    page.on('pageerror', (error) => saw('uncaught error', error.message));
    page.on('requestfailed', (request) => saw('failed request', `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'no reason given'}`));
    page.on('response', (response) => {
      if (response.status() < 400 || !this.origins.some((origin) => response.url().startsWith(origin))) return;
      const declared = this.expected.find((one) => one.step === this.step && !one.matched && one.status === response.status() && response.url().includes(one.urlPart));
      if (declared) {
        declared.matched = true;
        this.log('errors', `step ${this.step} · ${response.status()} ${response.url()} — declared by the step: ${declared.why}`);
        return;
      }
      saw(`answer ${response.status()}`, `${response.request().method()} ${response.url()}`);
    });
  }
}

export interface Run {
  config: WalkConfig;
  settings: RunSettings;
  words: Dictionary;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  folder: string;
  logFile: string;
  startedAt: Date;
  checks: Checks;
  errors: BrowserErrors;
  notes: string[];
  log(actor: string, message: string): void;
  note(line: string): void;
  person(key: string): Person;
}

/** Runs `{runId}`-filled `command` from the current folder; a non-zero exit throws by name. */
function runCommand(what: string, command: string, runId: string, log: (actor: string, message: string) => void): void {
  const filled = command.replace(/\{runId\}/g, runId);
  log('data', `${what}: ${filled}`);
  const ran = spawnSync(filled, { shell: true, encoding: 'utf8', env: { ...process.env, WALK_RUN_ID: runId } });
  for (const line of `${ran.stdout ?? ''}${ran.stderr ?? ''}`.split(/\r?\n/).filter(Boolean)) log('data', line);
  if (ran.error || ran.status !== 0) {
    throw new WalkError(`data.${what}_failed`, `${what} "${filled}" ${ran.error ? `could not start: ${ran.error.message}` : `exited ${ran.status}`}`);
  }
}

export async function openRun(config: WalkConfig, words: Dictionary, settings: RunSettings): Promise<Run> {
  const startedAt = new Date();
  const folder = resolve(config.reportFolder, config.name, settings.runId);
  mkdirSync(folder, { recursive: true });
  const logFile = join(folder, 'walk.log');
  const log = (actor: string, message: string): void => {
    const line = `[+${((Date.now() - startedAt.getTime()) / 1000).toFixed(3)}s] [${actor}] ${message}`;
    console.log(line);
    appendFileSync(logFile, line + '\n', 'utf8');
  };
  const notes: string[] = [];
  log('walk', `${config.name} · run ${settings.runId} · ${settings.appAddress} · mode ${settings.mode} · start step ${settings.startStep ?? (settings.mode === 'auto' ? 'the first' : 'chosen on the page')} · report folder ${folder}`);
  if (config.seedCommand) runCommand('seed', config.seedCommand, settings.runId, log);
  else log('data', 'no seed command — the walk uses data that exists (the brief says which)');

  const browser = await chromium.launch({ headless: !settings.headed, args: settings.headed ? ['--start-maximized'] : [] });
  // Headed: the page follows the maximized window, so the strip is never below the window's edge on a
  // smaller or display-scaled screen. Headless: a fixed page.
  const context = await browser.newContext({ viewport: settings.headed ? null : config.headlessViewport });
  // tsx/esbuild may wrap a named function inside a page callback in __name(); the page has none.
  await context.addInitScript('window.__name = window.__name || function (value) { return value; };');
  await context.addInitScript(walkOverlayScript({ direction: config.direction, words: overlayWords(words), fade: true }));
  await context.addInitScript(SCROLL_METER_SCRIPT);
  const page = await context.newPage();
  const errors = new BrowserErrors(config.appOrigins, log);
  errors.listen(page); // before the first navigation
  await page.goto(settings.appAddress, { waitUntil: 'domcontentloaded' });
  return {
    config, settings, words, browser, context, page, folder, logFile, startedAt, checks: new Checks(log), errors, notes, log,
    note: (line) => { notes.push(line); log('note', line); },
    person: (key) => {
      const found = config.people.find((one) => one.key === key);
      if (!found) throw new WalkError('walk.unknown_person', `no person "${key}" in the config — known: ${config.people.map((one) => one.key).join(', ')}`);
      return found;
    },
  };
}

/** A screenshot of the walk's page into the run folder; a failure to take it is noted, and does not hide what it was taken for. */
export async function shoot(run: Run, name: string): Promise<void> {
  const file = join(run.folder, `${name.replace(/[^\p{L}\p{N}_ .-]+/gu, '_').slice(0, 80)}.png`);
  try {
    await run.page.screenshot({ path: file });
    run.log('shot', file);
  } catch (thrown) {
    run.note(`the screenshot ${file} could not be taken: ${firstLineOf(thrown)}`);
  }
}

/** The cleanup, green or red; true when the data is gone (or kept on purpose and said so). */
export function cleanUp(run: Run): boolean {
  const { cleanupCommand } = run.config;
  if (run.settings.keepData) {
    run.note(`WALK_KEEP_DATA=yes — the data of run ${run.settings.runId} was left in place${cleanupCommand ? `; to remove it: ${cleanupCommand.replace(/\{runId\}/g, run.settings.runId)}` : ''}`);
    return true;
  }
  if (!cleanupCommand) {
    run.note('no cleanup command — the brief says this walk leaves nothing behind; check it did');
    return true;
  }
  try {
    runCommand('cleanup', cleanupCommand, run.settings.runId, run.log);
    return true;
  } catch (thrown) {
    run.note(`the cleanup failed: ${firstLineOf(thrown)} — the run's data may still be there`);
    return false;
  }
}
