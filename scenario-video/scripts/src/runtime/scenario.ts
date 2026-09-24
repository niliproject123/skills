// The scenario runtime: a story told through the browser, as the people in it, written once per
// video and run by `make.ts` with recording on (or on its own, as a plain test, with it off).
//
//   runScenario({
//     name: 'invite-a-teammate',
//     startUp: async (s) => ({ dana: await s.openPerson('Dana') }),
//     parts: [
//       { key: 'open-team', title: 'Opening the team page', needs: [], run: async ({ dana }) => {
//           await dana.goto('/team');
//           await dana.press('invite-button');
//       } },
//     ],
//   });
//
// What it does for every scenario: settings, browser, one context per person with its sign-in, the
// four listeners (zero browser errors), the watchdog, the parts, the checks, the report, and the
// exit code — 0 only when no check failed and no browser error was seen. Every wait is on state
// (`waitFor`, `race`), never on sleep; the only fixed waits are the recorder's pacing for a viewer.
import { chromium, selectors, type Browser, type BrowserContext, type Locator, type Page } from 'playwright';
import { join } from 'node:path';
import { appAddressOf, loadSettings, localeOf, personNamed, type VideoSettings } from '../config';
import { firstLineOf, VideoError } from '../errors';
import { Logger } from '../log';
import {
  finishGuideRecording, guideContextOptions, guideShowing, guideStep, guideWatching, isRecordingGuide, nameGuidePage, noteGuidePageOpened,
  prepareGuideContext, recordingFolder,
} from '../recorder';
import { controlsFor, describeTarget, type Target } from './controls';
import { watchNoise } from './listeners';
import { raceOutcomes, type NamedOutcome, type Settled } from './outcomes';
import type { DismissibleOverlay } from './overlays';
import { partsAsked, partsSummary, planParts, type PartDeclaration, type PartsPlan } from './parts';
import { writeScenarioReport } from './report';
import { completeSignIn, prepareSignIn } from './sign-in';
import { startWatchdog } from './watchdog';

export type { Locator, Page } from 'playwright';
export type { Target } from './controls';

export interface Person {
  name: string;
  page: Page;
  context: BrowserContext;
  /** Opens a path of the app (`/team`) or a full address. */
  goto: (path: string) => Promise<void>;
  locate: (target: Target) => Locator;
  /** Visible and enabled first, overlays put away, then the pointer and caption, then the click. */
  press: (target: Target, what?: string) => Promise<void>;
  fill: (target: Target, value: string, what?: string) => Promise<void>;
  /** A <select>: the option's value or label. */
  choose: (target: Target, value: string, what?: string) => Promise<void>;
  waitFor: (target: Target, state?: 'visible' | 'hidden', timeoutMs?: number) => Promise<void>;
  /**
   * Something to be watched rather than pressed — a report scrolling, an animation. The caption is
   * shown, `during` runs, and the cut keeps `holdMs` of it.
   */
  watch: (caption: string, holdMs: number, during: () => Promise<void>) => Promise<void>;
  /**
   * Something pointed at and named, not pressed — a row the film stops on, a panel that opened. It
   * waits for the target to be visible, draws the pointer, ring and caption on it (the ring follows
   * it while it is still moving), and holds `holdMs` of film. Target the whole thing the viewer
   * sees — the panel, not a label inside it.
   */
  show: (target: Target, caption: string, holdMs: number) => Promise<void>;
}

export interface Scenario {
  runId: string;
  appAddress: string;
  settings: VideoSettings;
  log: (actor: string, message: string) => void;
  note: (line: string) => void;
  /** A condition. Records PASS or `ASSERT FAILED: what (detail)`, never throws, returns the condition. */
  check: (what: string, condition: boolean, detail?: string) => boolean;
  /** Equality, printed as `expected X, got Y`. */
  same: (what: string, actual: unknown, expected: unknown) => boolean;
  /** A person from the settings, in a browser of their own, signed in, named on their video. */
  openPerson: (name: string, qualifier?: string) => Promise<Person>;
  race: <T>(what: string, outcomes: NamedOutcome<T>[], ceilingMs?: number) => Promise<Settled<T>>;
}

export interface ScenarioPart<World> extends PartDeclaration {
  run: (world: World, scenario: Scenario) => Promise<void>;
}

export interface ScenarioDefinition<World> {
  name: string;
  /** Opens the people the parts need. What `SCENARIO_PARTS=sign-in` stops after. */
  startUp: (scenario: Scenario) => Promise<World>;
  parts: readonly ScenarioPart<World>[];
  /** Closing checks, run once the chosen parts ran. Told which parts those were. */
  finish?: (world: World, scenario: Scenario, parts: PartsPlan) => Promise<void>;
  /** The app's overlays that may sit over a control and can be put away before a press. */
  dismissibleOverlays?: readonly DismissibleOverlay[];
  /** Identical one-second samples that mean a stall. Default 30. */
  stallTicks?: number;
}

export function runScenario<World>(definition: ScenarioDefinition<World>): void {
  void run(definition).then(
    (code) => process.exit(code),
    (thrown: unknown) => {
      console.error('FATAL', thrown);
      process.exit(1);
    },
  );
}

async function run<World>(definition: ScenarioDefinition<World>): Promise<number> {
  const started = Date.now();
  const logger = new Logger('scenario', started);
  let logLines = 0;
  const log = (actor: string, message: string): void => {
    logLines += 1;
    logger.forActor(actor).info(message);
  };
  const { settings } = loadSettings();
  const appAddress = appAddressOf(settings);
  const runId = process.env['SCENARIO_RUN_ID'] ?? `scenario-${new Date(started).toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')}`;
  if (!process.env['SCENARIO_RUN_ID']) log('scenario', `SCENARIO_RUN_ID is not set — this run is ${runId}, and no seed was run for it by this runtime`);
  const failures: string[] = [];
  const notes: string[] = [];
  const check = (what: string, condition: boolean, detail = ''): boolean => {
    if (condition) {
      log('check', `PASS ${what}`);
      return true;
    }
    const line = `ASSERT FAILED: ${what}${detail ? ` (${detail})` : ''}`;
    failures.push(line);
    log('check', line);
    return false;
  };
  const same = (what: string, actual: unknown, expected: unknown): boolean =>
    check(what, Object.is(actual, expected), `expected ${String(expected)}, got ${String(actual)}`);

  if (settings.locators.testIdAttribute) selectors.setTestIdAttribute(settings.locators.testIdAttribute);
  else {
    const warning = 'the settings name no test id attribute — controls are found by role, label and text, which break when the wording changes';
    logger.warn(warning);
    notes.push(`WARNING ${warning}`);
  }

  const noise = watchNoise([appAddress, ...settings.app.otherAddresses], log);
  let acting: Page | null = null;
  const watchdog = startWatchdog(
    { page: () => acting, log, counters: () => ({ answers: noise.answers(), noise: noise.count(), failures: failures.length, logs: logLines }) },
    definition.stallTicks === undefined ? {} : { stallTicks: definition.stallTicks },
  );
  const headed = process.env['SHOW_BROWSER'] === 'yes';
  let browser: Browser | null = null;
  let parts: PartsPlan | null = null;
  let ended: string | null = null;

  const openPerson = async (name: string, qualifier?: string): Promise<Person> => {
    if (!browser) throw new VideoError('scenario.no_browser', 'openPerson was called before the browser opened');
    const person = personNamed(settings, name);
    const shownAs = qualifier ? `${name} · ${qualifier}` : name;
    const context = await browser.newContext({ viewport: settings.viewport, locale: localeOf(settings.captions.language), ...guideContextOptions(settings.viewport) });
    // tsx rewrites a named function inside page.evaluate into `__name(...)`, which the page lacks.
    await context.addInitScript(() => {
      (window as unknown as { __name?: unknown }).__name ??= <T>(value: T): T => value;
    });
    await prepareGuideContext(context);
    await prepareSignIn(context, settings, person, appAddress);
    const page = await context.newPage();
    noteGuidePageOpened(page);
    noise.listen(page, shownAs);
    await completeSignIn(page, settings, person, appAddress);
    log('scenario', `${shownAs} is signed in (${settings.signIn.method})`);
    const controls = controlsFor(page, settings.locators.testIdAttribute, definition.dismissibleOverlays ?? [], log);
    const acted = <A extends unknown[], R>(action: (...args: A) => Promise<R>) => async (...args: A): Promise<R> => {
      acting = page;
      return action(...args);
    };
    let named = false;
    const nameOnce = async (): Promise<void> => {
      if (named) return;
      named = true;
      await nameGuidePage(page, shownAs);
    };
    return {
      name: shownAs,
      page,
      context,
      goto: acted(async (path: string) => {
        await page.goto(/^https?:/.test(path) ? path : new URL(path, `${appAddress}/`).href);
        await nameOnce();
      }),
      locate: controls.locate,
      press: acted(async (target: Target, what?: string) => { await nameOnce(); await controls.press(target, what); log(shownAs, `pressed ${what ?? describeTarget(target)}`); }),
      fill: acted(async (target: Target, value: string, what?: string) => { await nameOnce(); await controls.fill(target, value, what); log(shownAs, `filled ${what ?? describeTarget(target)}`); }),
      choose: acted(async (target: Target, value: string, what?: string) => { await nameOnce(); await controls.choose(target, value, what); log(shownAs, `chose ${value} in ${what ?? describeTarget(target)}`); }),
      waitFor: acted(controls.waitFor),
      watch: acted(async (caption: string, holdMs: number, during: () => Promise<void>) => {
        await nameOnce();
        await guideWatching(page, caption, caption, holdMs);
        await during();
      }),
      show: acted(async (target: Target, caption: string, holdMs: number) => {
        await nameOnce();
        const element = controls.locate(target).first();
        await element.waitFor({ state: 'visible' });
        await guideShowing(page, element, caption, caption, holdMs);
        if (isRecordingGuide()) await page.waitForTimeout(holdMs); // pacing: what is shown is read
        log(shownAs, `showed ${describeTarget(target)} — ${caption}`);
      }),
    };
  };

  const scenario: Scenario = {
    runId, appAddress, settings, log,
    note: (line) => { notes.push(line); },
    check, same, openPerson,
    race: (what, outcomes, ceilingMs) => raceOutcomes(log, what, outcomes, ceilingMs),
  };

  try {
    browser = await chromium.launch({ headless: !headed });
    const body = async (): Promise<void> => {
      parts = planParts(definition.parts, partsAsked());
      log('parts', `${parts.asked === null ? 'every part' : `SCENARIO_PARTS=${parts.asked.join(',')}`} — will run: ${parts.toRun.join(' · ') || 'none'}`);
      const world = await definition.startUp(scenario);
      log('parts', 'startup done — every person opened at the start is signed in');
      for (const part of definition.parts) {
        if (!parts.runs(part.key)) continue;
        log('parts', `▶ ${part.key}${parts.prerequisites.includes(part.key) ? ' (prerequisite)' : ''} — ${part.title}`);
        guideStep(part.title, part.subtitle);
        await part.run(world, scenario);
        parts.finished.push(part.key);
      }
      if (definition.finish) await definition.finish(world, scenario, parts);
    };
    await Promise.race([body(), watchdog.stalled, noise.stopped]);
  } catch (thrown) {
    ended = thrown instanceof Error ? (thrown.stack ?? thrown.message) : String(thrown);
    console.error('FATAL', thrown);
    failures.push(`ASSERT FAILED: the scenario reached its end (${firstLineOf(thrown)})`);
  }
  watchdog.stop();
  const partsLine = parts ? partsSummary(parts) : 'the parts were never planned';
  log('scenario', `${failures.length} failed check(s) · ${noise.count()} browser error(s) · ${partsLine}`);
  if (isRecordingGuide()) {
    const file = writeScenarioReport(recordingFolder(), {
      name: definition.name, runId, seconds: (Date.now() - started) / 1000, failures, notes, noise: noise.noise, parts: partsLine, ended,
      watchdog: { ticks: watchdog.ticks(), everyMs: watchdog.everyMs, stall: watchdog.stall(), dump: watchdog.dump(40) },
    });
    log('scenario', `report → ${file}`);
  } else {
    log('scenario', `no report file — not recording (${join('<recording folder>', 'scenario-report.md')} is written only when make.ts runs this)`);
  }
  // Closing a recorded context flushes its video; the page stands still meanwhile, and that is not a stall.
  await finishGuideRecording();
  if (browser) await browser.close();
  return failures.length === 0 && noise.count() === 0 ? 0 : 1;
}
