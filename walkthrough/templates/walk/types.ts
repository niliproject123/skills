// The shapes a walkthrough is written in: the settings, the people, the app's own sign-in hooks, a step,
// and what a step is handed while it runs. Nothing here does anything; every other file imports it.
import type { Locator, Page } from 'playwright';

export type Direction = 'rtl' | 'ltr';

/** One person who acts in the walk. One is the default; several are optional. */
export interface Person {
  /** What a step names in `actor`: 'dana'. */
  key: string;
  /** What the strip shows, in the strip's language: 'Dana'. */
  name: string;
  /** What the sign-in form takes. */
  username: string;
  /** The environment variable holding the password — never the password itself. */
  passwordVariable: string;
}

/** The settings of one walk, filled from the approved brief (`templates/brief.md`). */
export interface WalkConfig {
  /** The command's name: 'walkthrough-invite-a-teammate'. Also the report folder's name. */
  name: string;
  /** Where the app opens. `WALK_APP_ADDRESS` overrides it for one run. */
  appAddress: string;
  /** Addresses that are production. A walk writes, so it refuses these unless `allowProductionWrites`. */
  productionAddresses: string[];
  /** True only when the user said so in the brief, in those words. */
  allowProductionWrites: boolean;
  /** The app's origins (web and api). A 4xx/5xx answer from one of them is a browser error. */
  appOrigins: string[];
  /** The strip's direction. */
  direction: Direction;
  /** The strip's words: a copy of `dictionary.he.json` or `dictionary.en.json`, or the user's own. */
  dictionaryFile: string;
  people: Person[];
  /** The attribute that names a section of a screen: 'data-section'. The ring scrolls the section first. */
  sectionAttribute: string;
  /** What counts as "opened by an earlier press": menus, dialogs, side panels. */
  openedByPressSelector: string;
  /** Where the report folders go: 'walkthroughs/reports'. */
  reportFolder: string;
  /** Run before the browser opens, `{runId}` replaced; non-zero exit refuses the walk. null: the walk uses data that exists. */
  seedCommand: string | null;
  /** Run after the walk, green or red, `{runId}` replaced; non-zero exit fails the run. null only when nothing is written. */
  cleanupCommand: string | null;
  /** How long the ring stands on a control before it is touched. 600 is what a watcher's eye needs. */
  ringHoldMs: number;
  /** The page size when the browser is headless (a headed walk follows the maximized window). */
  headlessViewport: { width: number; height: number };
}

/**
 * The app-specific half, written once per app in the walk's entry file. Every touch inside goes
 * through `act`, so it is ringed, gated and recorded like a step's own.
 */
export interface AppHooks {
  /** On the sign-in screen: type the person's username and password, submit, resolve once the app shows them in. */
  signIn(page: Page, person: Person, password: string, act: Act): Promise<void>;
  /** Signed in: sign out through the app's own control, resolve once the sign-in screen is back. */
  signOut(page: Page, person: Person, act: Act): Promise<void>;
  /** Who the app says is signed in — read from the page (a header attribute), compared with `Person.username`. */
  whoIsSignedIn(page: Page): Promise<string>;
  /** The app folds sections: open the one named `sectionKey`. Omit when nothing folds. */
  unfoldSection?(page: Page, sectionKey: string): Promise<void>;
}

/** Every touch of a control. Each one: visible, scrolled to its section then itself, ringed, (gated), held, enabled, done. */
export interface Act {
  press(control: Locator, what: string): Promise<void>;
  fill(control: Locator, value: string, what: string): Promise<void>;
  choose(control: Locator, value: string | string[], what: string): Promise<void>;
  tick(control: Locator, what: string): Promise<void>;
  untick(control: Locator, what: string): Promise<void>;
  upload(control: Locator, files: string | string[], what: string): Promise<void>;
  /**
   * Ring a control without touching it. Use it before taking a clock: the first ringed action of a step
   * waits for "Next", so a clock started before it times the person, not the app.
   */
  point(control: Locator, what: string): Promise<void>;
}

/** A named way a wait can end; raced by `StepContext.race`. */
export interface NamedOutcome<T> {
  name: string;
  /** Handed the race's own signal, aborted when the race is decided — take long waits through `untilRaceEnds`. */
  wait: (raceEnded: AbortSignal) => Promise<T>;
}

export interface Settled<T> {
  /** The winner's name, or 'ceiling' when nothing settled in time. */
  name: string;
  value: T | undefined;
  seconds: number;
  ceiling: boolean;
}

/** The checks of the step now running, each named after the requirement it proves. */
export interface StepChecks {
  /** PASS when `condition`; FAIL otherwise. Never throws, never ends the walk. */
  check(requirement: string, name: string, condition: boolean, detail: { expected: string; received: string }): boolean;
  /** PASS when equal (strict, or JSON-equal for objects). */
  same<T>(requirement: string, name: string, actual: T, expected: T): boolean;
  /** The check could not be made here; `reason` is required and says why. Never counted as a pass. */
  notChecked(requirement: string, name: string, reason: string): void;
}

/** What a step's `run` is handed. */
export interface StepContext {
  page: Page;
  act: Act;
  checks: StepChecks;
  runId: string;
  /** A path of the app ('/team') or a full address, waited until the document is loaded. */
  goto(path: string): Promise<void>;
  /** Race named outcomes against a ceiling; the losers stop with the race. */
  race<T>(what: string, outcomes: NamedOutcome<T>[], ceilingMs: number): Promise<Settled<T>>;
  /** A 4xx/5xx this step expects (a refused form). Matched once, logged; an unmatched one is a FAIL at the step's end. */
  expectAnswer(match: { urlPart: string; status: number }, why: string): void;
  log(message: string): void;
}

/** One step of the scenario. */
export interface WalkStep<World> {
  /** The scenario's own number; null for a connecting press the scenario takes for granted (listed as "—", not choosable). */
  number: number | null;
  /** Lower-case words joined by hyphens, unique in the walk. */
  key: string;
  /** `Person.key` of who acts. */
  actor: string;
  /** One line: the action, as the strip title shows it. */
  caption: string;
  /** What happens and what should be seen, in the scenario's words — the strip reads it out. */
  description: string;
  /** The requirement ids this step's checks prove; the report lists a requirement no check named. */
  expects: readonly string[];
  run(step: StepContext, world: World): Promise<void>;
}

/** A heading of the scenario, grouping steps in the steps list. */
export interface WalkSection<World> {
  title: string;
  steps: WalkStep<World>[];
}

/** A named failure. `code` is what the log and the report print first. */
export class WalkError extends Error {
  constructor(readonly code: string, message: string, readonly context?: Record<string, unknown>) {
    super(`[${code}] ${message}`);
    this.name = 'WalkError';
  }
}

export const messageOf = (thrown: unknown): string => (thrown instanceof Error ? thrown.message : String(thrown));
export const firstLineOf = (thrown: unknown): string => messageOf(thrown).split('\n')[0] ?? '';
