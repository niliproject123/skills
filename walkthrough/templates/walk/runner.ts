// The stepped walk: the steps of a scenario, one at a time, on one page a person watches.
//
//   before a step   the strip says "Before step N/M · who: caption" and the description; the step starts at
//                   once, and its first touch rings the control and waits there for "Next" (the gate) — so
//                   navigating to its screen happens while "Next" stands
//   the step runs   every touch ringed and held; the strip faded to 0.1
//   after it        "After step N/M — done ✓ / failed", the failed checks or the error, the scroll it cost;
//                   "Next" again
//   change of user  a step of its own: "Change of user: sign out and sign in as <name>", through the app's
//                   own sign-in screen in the same window, then who the app says is in is compared
//
// The start step: before the first step the steps list is shown and the person picks where to start
// (or WALK_START_STEP names it). The steps before it run by themselves — they bring the app to the state
// the chosen step needs — and from it on every "Next" waits. "Continue automatically" (pressed twice)
// answers every "Next" by itself until "Pause". WALK_MODE=auto starts the overlay in that mode.
//
// A step that throws shows its error, waits for "Next", and ends the walk by name; the steps after it are
// reported as not reached. A browser error does the same at the end of the step it happened in. A FAIL
// check is recorded and the walk goes on. The exit code is the result.
import { join } from 'node:path';
import { cleanUp, openRun, readSettings, shoot, type Run } from './harness';
import { guideCall, isStepAgain, WalkControls } from './controls';
import { loadDictionary, say } from './dictionary';
import { raceOutcomes } from './outcomes';
import { readScroll, resetScroll } from './scroll-meter';
import { writeReport, type StepRow } from './checks';
import type { ListOption } from './overlay';
import {
  firstLineOf, WalkError, type AppHooks, type StepContext, type WalkConfig, type WalkSection, type WalkStep,
} from './types';

export interface WalkDefinition<World> {
  config: WalkConfig;
  hooks: AppHooks;
  sections: WalkSection<World>[];
  /** The state the steps share (an id one step creates and a later one reads). */
  makeWorld(runId: string): World | Promise<World>;
  /** Closing checks after the last step — what the walk should have left behind. Runs ungated. */
  finish?(step: StepContext, world: World): Promise<void>;
}

interface Walked<World> {
  section: string;
  step: WalkStep<World>;
}

interface WalkState {
  holder: string | null;
  actingAs: string;
  asked: number;
  waitFrom: number | null;
  total: number;
  rows: StepRow[];
}

/** Starts the walk and exits the process with its result. No top-level await is needed around it. */
export function runWalk<World>(definition: WalkDefinition<World>): void {
  void walk(definition).then(
    (code) => process.exit(code),
    (thrown: unknown) => {
      console.error('FATAL', thrown);
      process.exit(1);
    },
  );
}

/** Steps flattened in order, refused by name when keys, numbers or actors are wrong — before anything starts. */
function stepsOf<World>(definition: WalkDefinition<World>): Walked<World>[] {
  const walked = definition.sections.flatMap((section) => section.steps.map((step) => ({ section: section.title, step })));
  if (walked.length === 0) throw new WalkError('steps.none', 'the walk has no steps');
  const keys = new Set<string>();
  let lastNumber = 0;
  for (const { step } of walked) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(step.key)) throw new WalkError('steps.bad_key', `step key "${step.key}" — lower-case words joined by hyphens`);
    if (keys.has(step.key)) throw new WalkError('steps.duplicate_key', `two steps have the key "${step.key}"`);
    keys.add(step.key);
    if (step.number !== null) {
      if (step.number <= lastNumber) throw new WalkError('steps.bad_order', `step ${step.number} (${step.key}) comes after step ${lastNumber} — numbers rise in walk order`);
      lastNumber = step.number;
    }
    if (!definition.config.people.some((person) => person.key === step.actor)) throw new WalkError('steps.unknown_actor', `step ${step.key} names actor "${step.actor}", who is not in the config's people`);
    if (!step.caption.trim() || !step.description.trim()) throw new WalkError('steps.no_words', `step ${step.key} has no caption or no description`);
  }
  return walked;
}

async function walk<World>(definition: WalkDefinition<World>): Promise<number> {
  const words = loadDictionary(definition.config.dictionaryFile);
  const settings = readSettings(definition.config);
  const walked = stepsOf(definition);
  const run = await openRun(definition.config, words, settings);
  const state: WalkState = { holder: null, actingAs: say(words, 'nobodySignedIn'), asked: 0, waitFrom: null, total: walked.filter(({ step }) => step.number !== null).length, rows: [] };
  const controls = new WalkControls(run.page, run.config, definition.hooks, words, run.log, () => state.holder ?? '', (what) => run.errors.quiet(what));
  let ended = 'the last step and the closing checks ran';
  let reachedEnd = false;
  let where = 'the start (makeWorld, the start step)';
  let startStep = 'not reached';
  try {
    const world = await definition.makeWorld(settings.runId);
    run.log('walk', `this run walks ${walked.length} steps, ${state.total} of them numbered`);
    startStep = await chooseTheStart(run, state, walked);
    for (const item of walked) {
      where = `step ${item.step.number ?? '—'} · ${item.step.key}`;
      await walkOneStep(run, state, controls, definition, world, item);
    }
    where = 'the closing checks';
    if (definition.finish) {
      run.errors.stepIs('finish');
      await guideCall(run.page, 'show', { who: holderName(run, state), section: '', title: say(words, 'closingChecks'), caption: '' });
      await definition.finish(stepContext(run, state, controls, 'finish', 'walk'), world);
    }
    reachedEnd = run.errors.lines.length === 0;
    if (!reachedEnd) ended = 'browser errors during the closing checks';
  } catch (thrown) {
    ended = `stopped at ${where}: ${firstLineOf(thrown)}`;
    run.log('walk', `FATAL ${ended}`);
    console.error('FATAL', thrown);
    await shoot(run, 'stopped');
  }
  for (const { step } of walked.slice(state.rows.length)) {
    state.rows.push({ number: String(step.number ?? '—'), key: step.key, actor: run.person(step.actor).name, result: 'not reached', beforeStart: false, actingSeconds: null, waitingSeconds: null, scroll: null, scrollFailure: '' });
  }
  await run.browser.close().catch((thrown: unknown) => run.note(`closing the browser failed: ${firstLineOf(thrown)}`));
  const cleaned = cleanUp(run);
  const exitCode = reachedEnd && run.checks.count('FAIL') === 0 && cleaned ? 0 : 1;
  const unproved = walked.slice(0, state.rows.filter((row) => row.result !== 'not reached').length).flatMap(({ step }) => {
    const named = new Set(run.checks.ofStep(`${step.number ?? '—'} · ${step.key}`).map((one) => one.requirement));
    return step.expects.filter((requirement) => !named.has(requirement)).map((requirement) => ({ step: `${step.number ?? '—'} · ${step.key}`, requirement }));
  });
  const reportFile = join(run.folder, 'walk-report.md');
  writeReport(reportFile, {
    walk: run.config.name, runId: settings.runId, appAddress: settings.appAddress, mode: settings.mode,
    startStep, startedAt: run.startedAt,
    seconds: (Date.now() - run.startedAt.getTime()) / 1000, exitCode, ended, steps: state.rows, checks: run.checks.records,
    unproved, browserErrors: run.errors.lines, notes: run.notes, logFile: run.logFile,
  });
  run.log('walk', `${run.checks.count('PASS')} PASS · ${run.checks.count('FAIL')} FAIL · ${run.checks.count('NOT CHECKED')} NOT CHECKED · ${run.errors.lines.length} browser errors · exit ${exitCode} · report → ${reportFile}`);
  return exitCode;
}

const holderName = (run: Run, state: WalkState): string => (state.holder ? run.person(state.holder).name : say(run.words, 'nobodySignedIn'));

function stepContext(run: Run, state: WalkState, controls: WalkControls, reportName: string, actorName: string): StepContext {
  return {
    page: run.page,
    act: controls.act(() => state.actingAs),
    checks: run.checks.forStep(reportName, actorName),
    runId: run.settings.runId,
    goto: async (path) => {
      const address = /^https?:\/\//.test(path) ? path : new URL(path, run.settings.appAddress).toString();
      await run.errors.quiet(`before opening ${address}`);
      await run.page.goto(address, { waitUntil: 'domcontentloaded' });
    },
    race: (what, outcomes, ceilingMs) => raceOutcomes((message) => run.log(actorName, message), what, outcomes, ceilingMs),
    expectAnswer: (match, why) => run.errors.expect(match, why),
    log: (message) => run.log(actorName, message),
  };
}

/** The steps list: chosen from on the page (or WALK_START_STEP), then kept as a read-only list on the strip. */
async function chooseTheStart<World>(run: Run, state: WalkState, walked: Walked<World>[]): Promise<string> {
  const { words, settings, page } = run;
  const options: ListOption[] = walked.map(({ section, step }) => ({
    value: step.number === null ? '' : String(step.number),
    section,
    mark: step.number === null ? say(words, 'unnumberedMark') : say(words, 'stepMark', { n: step.number }),
    label: `${run.person(step.actor).name} · ${step.caption}`,
  }));
  const numbers = walked.flatMap(({ step }) => (step.number === null ? [] : [step.number]));
  const keepTheList = (): Promise<void> => guideCall(page, 'list', `${settings.runId}-steps`, say(words, 'stepsListTitle'), options, false);
  if (settings.mode === 'auto') {
    await guideCall(page, 'setMode', 'auto');
    await keepTheList();
    run.log('walk', 'WALK_MODE=auto — every Next is answered by the runner until Pause is pressed');
    return 'none (WALK_MODE=auto)';
  }
  const first = numbers[0];
  if (first === undefined) {
    await keepTheList();
    run.log('walk', 'no numbered step — no start step to choose');
    return 'none (no numbered step)';
  }
  let start: number;
  if (settings.startStep !== null) {
    if (!numbers.includes(settings.startStep)) throw new WalkError('walk.unknown_start_step', `WALK_START_STEP is ${settings.startStep}, not a step of this walk — the steps: ${numbers.join(' · ')}`);
    start = settings.startStep;
  } else {
    state.asked += 1;
    const id = `${settings.runId}-start`;
    await guideCall(page, 'show', { who: say(words, 'nobodySignedIn'), section: '', title: say(words, 'chooseStartStrip'), caption: say(words, 'chooseStartCaption') });
    await guideCall(page, 'list', id, say(words, 'chooseStartTitle'), options, true);
    run.log('walk', 'waiting for the start step to be chosen on the page');
    const answer = await page.waitForFunction((listId) => {
      const guide = (window as unknown as { __walkGuide?: { picked(id: string): string } }).__walkGuide;
      return (guide && guide.picked(listId)) || false;
    }, id, { timeout: 0, polling: 250 });
    start = Number(await answer.jsonValue());
    if (!numbers.includes(start)) throw new WalkError('walk.unknown_start_step', `the list answered ${start}, which is not a step of this walk`);
  }
  await keepTheList();
  run.note(`start step ${start}${settings.startStep !== null ? ' (WALK_START_STEP)' : ' (chosen on the page)'}; ${start === first ? 'every step waits for Next' : 'the steps before it ran by themselves'}`);
  const said = `${start}${settings.startStep !== null ? ' (WALK_START_STEP)' : ' (chosen on the page)'}`;
  if (start === first) return said;
  state.waitFrom = start;
  await guideCall(page, 'setMode', 'auto');
  return said;
}

/** Before → (the change of person) → "Next" at the first touch → the step → after → "Next". */
async function walkOneStep<World>(run: Run, state: WalkState, controls: WalkControls, definition: WalkDefinition<World>, world: World, item: Walked<World>): Promise<void> {
  const { step, section } = item;
  const { words, page } = run;
  const label = String(step.number ?? '—');
  const reportName = `${label} · ${step.key}`;
  if (state.waitFrom !== null && step.number === state.waitFrom) {
    state.waitFrom = null;
    await guideCall(page, 'setMode', 'wait');
    run.log('walk', `step ${label} is the chosen start — waiting for Next from here`);
  }
  const beforeStart = state.waitFrom !== null;
  const actor = run.person(step.actor);
  await guideCall(page, 'current', label);
  run.errors.stepIs(reportName);
  const errorsBefore = run.errors.lines.length;
  let scrollFailure = '';
  await resetScroll(page).catch((thrown: unknown) => { scrollFailure = `the reset at the step's start failed — ${firstLineOf(thrown)}`; });
  controls.takeWaited();
  const started = Date.now();

  let thrown: unknown = null;
  try {
    await handTo(run, state, controls, definition.hooks, step.actor, section);
  } catch (error) {
    thrown = error;
    run.log('walk', `the change of user before step ${reportName} failed — ${firstLineOf(error)}`);
  }
  state.actingAs = actor.name;
  const stepWord = step.number === null ? say(words, 'stepUnnumbered') : say(words, 'stepNumbered', { n: step.number, total: state.total });
  const view = (when: string): { who: string; section: string; title: string; caption: string } => ({
    who: holderName(run, state), section, title: say(words, 'titleLine', { when, who: actor.name, caption: step.caption }), caption: step.description,
  });
  if (thrown === null) {
    await guideCall(page, 'unfollow');
    await guideCall(page, 'result', '', false);
    await guideCall(page, 'scroll', '', false);
    await guideCall(page, 'show', view(say(words, 'beforeStep', { step: stepWord })));
    const id = await askNext(run, state, `before step ${reportName}`);
    run.log(actor.name, `step ${reportName}${step.expects.length ? ` · requirements ${step.expects.join(', ')}` : ''} — ${step.caption}`);
    try {
      await gatedRun(run, controls, id, `step ${reportName}`, () => step.run(stepContext(run, state, controls, reportName, actor.name), world));
    } catch (error) {
      thrown = error;
      run.log('walk', `step ${reportName} threw — ${firstLineOf(error)}`);
    }
  }
  const waited = controls.takeWaited();
  const actingSeconds = (Date.now() - started - waited) / 1000;

  const checks = run.checks.forStep(reportName, actor.name);
  for (const missing of run.errors.unmatched(reportName)) {
    checks.check('declared answer', `the answer the step declared came: ${missing}`, false, { expected: missing, received: 'no such answer' });
  }
  let scroll: { pixels: number; screens: number } | null = null;
  if (!scrollFailure) {
    try {
      scroll = await readScroll(page);
    } catch (error) {
      scrollFailure = `the reading at the step's end failed — ${firstLineOf(error)}`;
    }
  }
  if (scrollFailure) checks.notChecked('scroll per step', 'the step\'s scrolling was measured', scrollFailure);
  const mine = run.checks.ofStep(reportName);
  const failedChecks = mine.filter((one) => one.status === 'FAIL').map((one) => `${one.requirement}: ${one.name}`);
  const notChecked = mine.filter((one) => one.status === 'NOT CHECKED').map((one) => one.requirement);
  const browserErrors = run.errors.lines.slice(errorsBefore);
  const failed = thrown !== null || browserErrors.length > 0 || failedChecks.length > 0;
  const resultLine = thrown !== null ? firstLineOf(thrown)
    : browserErrors.length > 0 ? say(words, 'browserError', { line: browserErrors[0] ?? '' })
      : failedChecks.length > 0 ? say(words, 'failedChecks', { count: failedChecks.length, names: failedChecks.slice(0, 3).join(' · ') + (failedChecks.length > 3 ? ' …' : '') })
        : notChecked.length > 0 ? say(words, 'notCheckedNote', { count: notChecked.length, names: notChecked.join(' · ') }) : '';
  state.rows.push({
    number: label, key: step.key, actor: actor.name, beforeStart,
    result: thrown !== null ? `error: ${firstLineOf(thrown)}` : browserErrors.length > 0 ? `browser error: ${browserErrors[0]}` : failedChecks.length > 0 ? 'failed checks' : 'done',
    actingSeconds: Number(actingSeconds.toFixed(1)), waitingSeconds: Number((waited / 1000).toFixed(1)), scroll, scrollFailure,
  });
  run.log('scroll', `step ${reportName} · ${scroll ? `${scroll.pixels} px · ${scroll.screens.toFixed(1)} screens` : `not measured · ${scrollFailure}`}`);
  const show = async (): Promise<void> => {
    await guideCall(page, 'show', view(say(words, failed ? 'afterFailed' : 'afterDone', { step: stepWord })));
    await guideCall(page, 'result', resultLine, failed);
    await guideCall(page, 'scroll', scroll ? say(words, 'scrolled', { screens: scroll.screens.toFixed(1), pixels: scroll.pixels.toLocaleString('en-US') }) : say(words, 'scrollNotMeasured', { message: scrollFailure }), scroll === null);
    if (failed) await shoot(run, `step ${label} ${step.key} — failed`);
    await waitForNext(run, state, controls, `after step ${reportName}`);
  };
  if (thrown === null && browserErrors.length === 0) {
    await show();
    return;
  }
  // The step's own failure ends the walk. A failure to show it is noted beside it, never instead of it.
  try {
    await show();
  } catch (showing) {
    run.note(`the failure of step ${reportName} could not be shown on the strip: ${firstLineOf(showing)}`);
  }
  throw thrown ?? new WalkError('walk.browser_error', `${browserErrors.length} browser error(s) in step ${reportName}: ${browserErrors[0]}`);
}

/** The window handed to `actorKey`: at once when it is theirs, otherwise a change of user of its own on the strip. */
async function handTo(run: Run, state: WalkState, controls: WalkControls, hooks: AppHooks, actorKey: string, section: string): Promise<void> {
  if (state.holder === actorKey) return;
  const { words, page } = run;
  const person = run.person(actorKey);
  const leaving = state.holder ? run.person(state.holder) : null;
  const view = {
    who: leaving ? leaving.name : say(words, 'nobodySignedIn'), section,
    title: say(words, 'changeOfPerson', { name: person.name }),
    caption: leaving ? say(words, 'changeCaptionSwitch', { leaving: leaving.name, name: person.name }) : say(words, 'changeCaptionFirst', { name: person.name }),
  };
  await guideCall(page, 'unfollow');
  await guideCall(page, 'result', '', false);
  await guideCall(page, 'show', view);
  const what = `change of user to ${person.name}`;
  const id = await askNext(run, state, `before the ${what}`);
  const password = run.settings.passwords[person.key];
  if (password === undefined) throw new WalkError('walk.no_password', `no password was read for ${person.name}`);
  const act = controls.act(() => state.actingAs);
  await gatedRun(run, controls, id, what, async () => {
    if (leaving) {
      state.actingAs = leaving.name;
      await hooks.signOut(page, leaving, act);
      run.log(leaving.name, 'signed out');
    }
    state.actingAs = person.name;
    await hooks.signIn(page, person, password, act);
  });
  const signedIn = await hooks.whoIsSignedIn(page);
  if (signedIn !== person.username) {
    throw new WalkError('walk.signed_in_as_somebody_else', `after signing in as ${person.username} the app says ${signedIn || 'nobody'} is signed in — every step after it would act as the wrong person`);
  }
  state.holder = actorKey;
  run.log(person.name, `signed in on the app's own form as ${person.username}`);
  await guideCall(page, 'show', { ...view, who: person.name });
  await guideCall(page, 'result', say(words, 'nowSignedIn', { name: person.name }), false);
  await waitForNext(run, state, controls, `after the ${what}`);
}

/**
 * `act` started at once, its first touch waiting on the "Next" asked under `id` with the ring on the
 * control. An act that touched no control waits for that "Next" when it ends; one that threw drops the gate
 * and throws. "Return here" into something opened throws STEP_AGAIN: the act runs again from its start.
 */
async function gatedRun(run: Run, controls: WalkControls, id: string, what: string, act: () => Promise<void>): Promise<void> {
  for (;;) {
    controls.gateTheNextTouch(async () => {
      run.log('walk', `the ring stands on the first control · ${what}`);
      await controls.untilAnswered(id, `${what} — the ring on its first control`, true);
    });
    try {
      await act();
    } catch (error) {
      controls.takeTheGateOff();
      if (!isStepAgain(error)) throw error;
      run.log('walk', `${what}: Return here — runs again from its start`);
      continue;
    }
    if (controls.takeTheGateOff()) {
      run.log('walk', `${what}: touched no control — it ran before Next, which still stands`);
      await controls.untilAnswered(id, `${what} (touched no control)`, false);
    }
    return;
  }
}

/** "Next" drawn under a fresh id; pressed at once by the runner when the overlay's mode is auto. */
async function askNext(run: Run, state: WalkState, what: string): Promise<string> {
  state.asked += 1;
  const id = `${run.settings.runId}-${state.asked}`;
  await guideCall(run.page, 'ask', id, true);
  // Read the mode and act on it in one evaluate, so a Pause pressed meanwhile takes effect at the next question.
  const pressedByItself = await run.page.evaluate((questionId) => {
    const guide = (window as unknown as { __walkGuide?: { answered(): string; mode(): string; pressNext(): void } }).__walkGuide;
    if (!guide) throw new Error('the walk overlay is not on this page');
    if (guide.answered() === questionId || guide.mode() !== 'auto') return false;
    guide.pressNext();
    return true;
  }, id);
  run.log('walk', pressedByItself ? `auto — Next pressed by the runner · ${what}` : `waiting for Next · ${what}`);
  return id;
}

async function waitForNext(run: Run, state: WalkState, controls: WalkControls, what: string): Promise<void> {
  await controls.untilAnswered(await askNext(run, state, what), what, false);
}
