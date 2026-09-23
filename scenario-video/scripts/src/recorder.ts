// The recording side of a guide video. Every export is a no-op unless `VIDEO_RECORDING_FOLDER` is
// set, so a scenario or test that calls these runs exactly as before when nobody is recording.
//
// While recording:
//   • every browser context records a video (`guideContextOptions`) and carries the overlay
//     (`prepareGuideContext`, `overlay.ts`);
//   • each page is named after the person using it (`nameGuidePage`), and its video's start time
//     is noted (`noteGuidePageOpened`) so an event can be placed on that person's video;
//   • a step shows a title card the first time a person acts in it; each press points at the
//     control and captions it; each fill captions the field — then the scenario's own action goes on;
//   • every one of those is appended to `timeline.jsonl`, and every page to `pages.jsonl`, as it
//     happens — a run that dies half-way still leaves the part it recorded.
//
// `build.ts` cuts the videos by that timeline. What the recorder draws — the words, the look, the
// chapters — comes from `recording-plan.json`, which `make.ts` writes before the scenario starts.
import type { BrowserContext, Locator, Page } from 'playwright';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { firstLineOf } from './errors';
import { Logger } from './log';
import { OVERLAY_GLOBAL, CARD_FADE_SECONDS, overlayScript } from './overlay';
import { captionForFill, captionForPress } from './captions';
import { patternFrom, readRecordingPlan, type ChapterWritten, type RecordingPlan } from './plan';

/** Where the recording goes. Setting it is what turns recording on. */
export const RECORDING_FOLDER_VARIABLE = 'VIDEO_RECORDING_FOLDER';
export function recordingFolder(): string {
  const set = process.env[RECORDING_FOLDER_VARIABLE];
  return set ? resolve(set) : '';
}
export function isRecordingGuide(): boolean {
  return recordingFolder() !== '';
}

export const TIMELINE_FILE = 'timeline.jsonl';
export const PAGES_FILE = 'pages.jsonl';
/** What went wrong while recording — `build.ts` prints every line of it into the video log. */
export const PROBLEMS_FILE = 'problems.jsonl';

// Pacing for a viewer. The only fixed waits the recorder adds, and why each exists:
/** The title card stands long enough to read a heading and its people. The fade in is inside it. */
export const TITLE_CARD_MS = 3_000;
/** The card's fade out, as long as its opacity transition in `overlay.ts`. */
export const CARD_FADE_MS = Math.round(CARD_FADE_SECONDS * 1000);
/** The pointer travels to the control and rests on it before the click, so the eye can follow. */
export const POINT_MS = 900;
/** A field's caption is on screen before the typing starts. */
export const FILL_CAPTION_MS = 500;
/** A side note on the strip is one phrase; a longer one is written into problems.jsonl. */
export const ONE_PHRASE_LIMIT = 44;
/** A caption is one line read in passing; a control's words are cut to fit. */
export const CAPTION_LIMIT = 34;

/**
 * What a clip is cut around. `watch` is for what must be seen and is not pressed — a report
 * scrolling, an animation: it carries `holdMs`, and the cutter keeps that much of it.
 */
export type GuideEventKind = 'title' | 'press' | 'fill' | 'watch';

export interface GuideEvent {
  kind: GuideEventKind;
  /** The person, as the scenario names them. */
  who: string;
  /** Which of that person's pages — `<process>-<n>`, unique across worker processes. */
  pageId: string;
  /** The step's title, as the scenario gave it. */
  step: string;
  /** The scenario's own words for the control — what the plan's rules match against. */
  what: string;
  /** What the viewer read on screen. */
  caption: string;
  /** Milliseconds into this page's video. */
  atMs: number;
  /** Wall clock, to put clips of several people in order and to read beside the scenario log. */
  epochMs: number;
  holdMs?: number;
}

export interface GuidePage {
  pageId: string;
  who: string;
  openedAtEpochMs: number;
  videoFile: string;
}

interface PageState {
  id: string;
  who: string | null;
  openedAt: number;
  titledStep: string;
}

interface CardContent {
  title: string;
  subtitle: string;
  who: string;
  people: string[];
  sideNotes: string[];
  slideNotes: string[];
}

type OverlayApi = {
  who(name: string): void;
  step(title: string, subtitle: string, sides: readonly string[]): void;
  card(slide: CardContent | null, on: boolean): void;
  caption(text: string): void;
  point(x: number, y: number, width: number, height: number): void;
};

const log = new Logger('scenario-video');
const pages = new Map<Page, PageState>();
const contexts = new Set<BrowserContext>();
let pagesOpened = 0;
let currentStep = '';
let currentSubtitle = '';
let currentChapter: ChapterWritten | null = null;
let loadedPlan: RecordingPlan | null = null;

/** The recording plan `make.ts` wrote. The self-check hands its own in with `useRecordingPlan`. */
function plan(): RecordingPlan {
  loadedPlan ??= readRecordingPlan(recordingFolder());
  return loadedPlan;
}
export function useRecordingPlan(recordingPlan: RecordingPlan): void {
  loadedPlan = recordingPlan;
}

/** Logged now, and written where the video log will read it — never only a console line. */
function problem(message: string): void {
  log.error(message);
  appendFileSync(join(recordingFolder(), PROBLEMS_FILE), `${JSON.stringify({ epochMs: Date.now(), message })}\n`);
}

/** Spread into `browser.newContext({...})`: records at the viewport's own size. */
export function guideContextOptions(viewport: { width: number; height: number }): { recordVideo?: { dir: string; size: { width: number; height: number } } } {
  if (!isRecordingGuide()) return {};
  const raw = join(recordingFolder(), 'raw');
  mkdirSync(raw, { recursive: true });
  return { recordVideo: { dir: raw, size: viewport } };
}

/** The overlay, before any page script runs; the context is remembered so it can be closed. */
export async function prepareGuideContext(context: BrowserContext): Promise<void> {
  if (!isRecordingGuide()) return;
  contexts.add(context);
  context.on('close', () => contexts.delete(context));
  // tsx compiles a named arrow inside a page.evaluate body into `__name(fn, "fn")`, which does not
  // exist in the page — the recorder's own reads of a control's words would die on it. Identity shim.
  await context.addInitScript(() => {
    (window as unknown as { __name?: unknown }).__name ??= <T>(value: T): T => value;
  });
  await context.addInitScript(overlayScript(plan().look));
}

/** Right after `newPage()`: the video of this page starts now. */
export function noteGuidePageOpened(page: Page): void {
  if (!isRecordingGuide()) return;
  pagesOpened += 1;
  pages.set(page, { id: `${process.pid}-${pagesOpened}`, who: null, openedAt: Date.now(), titledStep: '' });
}

/** Overlay calls go through here: a page that navigated away mid-call is written down, never hidden. */
async function drawOn(page: Page, what: string, draw: () => Promise<unknown>): Promise<void> {
  await draw().catch((thrown: unknown) => problem(`the overlay could not draw ${what}: ${firstLineOf(thrown)}`));
}

/** One call into the overlay, by method name — no code is evaluated in the app's page. */
async function callOverlay(page: Page, what: string, method: keyof OverlayApi, ...args: unknown[]): Promise<void> {
  await drawOn(page, what, () =>
    page.evaluate(
      ([name, called, values]) => {
        const api = (window as unknown as Record<string, Record<string, (...all: unknown[]) => void> | undefined>)[name as string];
        if (!api) throw new Error('the overlay is not on this page');
        const target = api[called as string];
        if (!target) throw new Error(`the overlay has no ${called as string}`);
        target(...(values as unknown[]));
      },
      [OVERLAY_GLOBAL, method, args] as const,
    ),
  );
}

/** The person this page belongs to. Only named pages reach a video. */
export async function nameGuidePage(page: Page, who: string): Promise<void> {
  if (!isRecordingGuide()) return;
  const state = pages.get(page);
  if (!state) {
    problem(`${who}'s page was never noted as opened (noteGuidePageOpened) — its events cannot be placed on a video and it is left out`);
    return;
  }
  const video = page.video();
  if (!video) {
    problem(`${who}'s page has no video although recording is on — its context was made without guideContextOptions`);
    return;
  }
  state.who = who;
  const entry: GuidePage = { pageId: state.id, who, openedAtEpochMs: state.openedAt, videoFile: await video.path() };
  appendFileSync(join(recordingFolder(), PAGES_FILE), `${JSON.stringify(entry)}\n`);
  // Whose screen this is stays on screen the whole film: a viewer who joins at any second can say.
  await callOverlay(page, `the name ${who}`, 'who', who);
}

function onePhrase(line: string, step: string): void {
  if (line.length > ONE_PHRASE_LIMIT) {
    problem(`the side note "${line}" of the step "${step}" is ${line.length} characters — the strip holds one phrase (${ONE_PHRASE_LIMIT}) and draws the rest as an ellipsis. Shorten it in the plan`);
  }
}

/** A step begins. Each person sees its title card the first time they act in it. */
export function guideStep(title: string, subtitle?: string): void {
  if (!isRecordingGuide()) return;
  currentStep = title;
  currentSubtitle = subtitle ?? '';
  currentChapter = plan().chapters.find((chapter) => patternFrom(chapter.step).test(title)) ?? null;
  for (const note of currentChapter?.sideNotes ?? []) onePhrase(note, title);
}

function record(page: Page, kind: GuideEventKind, what: string, caption: string, holdMs?: number): void {
  const state = pages.get(page);
  if (!state?.who) return;
  const now = Date.now();
  const event: GuideEvent = {
    kind, who: state.who, pageId: state.id, step: currentStep, what, caption,
    atMs: now - state.openedAt, epochMs: now, ...(holdMs === undefined ? {} : { holdMs }),
  };
  appendFileSync(join(recordingFolder(), TIMELINE_FILE), `${JSON.stringify(event)}\n`);
}

/** The title card before a step: three seconds, fading in and out. */
async function titleCardIfNew(page: Page, state: PageState): Promise<void> {
  if (!currentStep || state.titledStep === currentStep) return;
  state.titledStep = currentStep;
  record(page, 'title', currentStep, currentStep);
  const card: CardContent = {
    title: currentStep,
    subtitle: currentSubtitle,
    who: state.who ?? '',
    people: currentChapter?.people ?? [],
    sideNotes: currentChapter?.sideNotes ?? [],
    slideNotes: currentChapter?.slideNotes ?? [],
  };
  await callOverlay(page, 'the step on the strip', 'step', card.title, card.subtitle, card.sideNotes);
  await callOverlay(page, 'the title card', 'card', card, true);
  await page.waitForTimeout(TITLE_CARD_MS); // pacing: what a viewer reads a heading and its people in
  await callOverlay(page, 'the title card fading out', 'card', null, false);
  // The fade is an opacity transition in the page; the next action must not start under it.
  await page.waitForTimeout(CARD_FADE_MS);
}

async function pointAt(page: Page, control: Locator, caption: string): Promise<void> {
  const box = await control.boundingBox().catch((thrown: unknown) => {
    problem(`no box for the control captioned "${caption}" — the pointer stays where it was: ${firstLineOf(thrown)}`);
    return null;
  });
  await callOverlay(page, `the caption "${caption}"`, 'caption', caption);
  if (box) await callOverlay(page, `the pointer for "${caption}"`, 'point', box.x, box.y, box.width, box.height);
}

/** A selector, not a name: what a scenario that presses by test id or CSS passes as `what`. */
const looksLikeASelector = (what: string): boolean => /[[\].#=">]/.test(what) || what.trim() === '';

/** Cut at the first ` · ` or ` — ` (a label and its help text), then at the last word that fits. */
export function shortCaption(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= CAPTION_LIMIT) return trimmed;
  const head = trimmed.split(/\s[·—]\s/)[0]?.trim() ?? trimmed;
  if (head.length <= CAPTION_LIMIT) return head;
  const cut = head.slice(0, CAPTION_LIMIT);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > CAPTION_LIMIT / 2 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** The visible words on a control: its text, else aria-label, else title. A bare number is not a name. */
async function textOf(control: Locator): Promise<string> {
  return control
    .evaluate((node) => {
      const element = node as HTMLElement;
      const named = (text: string): string => (/\p{L}/u.test(text) ? text : '');
      const own = named((element.innerText || '').trim());
      const spoken = named((element.getAttribute('aria-label') ?? element.getAttribute('title') ?? '').trim());
      return (own || spoken).split('\n')[0]?.trim() ?? '';
    })
    .catch((thrown: unknown) => {
      problem(`could not read the words on a control, the scenario's own name is used: ${firstLineOf(thrown)}`);
      return '';
    });
}

/** The words on screen for a field: its <label>, aria-labelledby, aria-label, placeholder, title. */
async function labelOf(control: Locator): Promise<string> {
  return control
    .evaluate((node) => {
      const field = node as HTMLInputElement;
      const clean = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();
      const label = field.labels?.[0];
      if (label) return clean(label.innerText);
      const by = field.getAttribute('aria-labelledby');
      if (by) {
        const words = by.split(/\s+/).map((id) => document.getElementById(id)?.innerText ?? '').join(' ');
        if (clean(words)) return clean(words);
      }
      return clean(field.getAttribute('aria-label') ?? field.getAttribute('placeholder') ?? field.getAttribute('title'));
    })
    .catch((thrown: unknown) => {
      problem(`could not read a field's label, the scenario's own name is used: ${firstLineOf(thrown)}`);
      return '';
    });
}

/** Before the scenario clicks: the title card if the step is new to this person, the caption, the pointer. */
export async function guideBeforePress(page: Page, control: Locator, what: string): Promise<void> {
  if (!isRecordingGuide()) return;
  const state = pages.get(page);
  if (!state?.who) return;
  await titleCardIfNew(page, state);
  // A selector is what the scenario called it as often as a name; the words on the control win.
  const name = shortCaption(looksLikeASelector(what) ? (await textOf(control)) || what : what);
  const caption = captionForPress(name, plan().words, plan().captionRules);
  record(page, 'press', name, caption);
  await pointAt(page, control, caption);
  await page.waitForTimeout(POINT_MS); // pacing: the pointer's travel, then a beat on the control
}

/** Before the scenario fills a field: the title card if new, and the field's caption. */
export async function guideBeforeFill(page: Page, control: Locator, field: string, caption?: string): Promise<void> {
  if (!isRecordingGuide()) return;
  const state = pages.get(page);
  if (!state?.who) return;
  await titleCardIfNew(page, state);
  const name = shortCaption((await labelOf(control)) || field);
  const said = caption ?? captionForFill(name, plan().words, plan().captionRules);
  record(page, 'fill', field, said);
  await pointAt(page, control, said);
  await page.waitForTimeout(FILL_CAPTION_MS); // pacing: the caption is up before the typing
}

/**
 * Something on screen is meant to be watched — not pressed, not typed into. The caption is drawn
 * without a pointer. It returns at once: the caller does the waiting, since that is what is watched.
 */
export async function guideWatching(page: Page, what: string, caption: string, holdMs: number): Promise<void> {
  if (!isRecordingGuide()) return;
  const state = pages.get(page);
  if (!state?.who) return;
  await titleCardIfNew(page, state);
  record(page, 'watch', what, caption, holdMs);
  await callOverlay(page, `the caption "${caption}"`, 'caption', caption);
}

/**
 * Close every recorded context. Playwright finishes a video file only when its context closes — a
 * `browser.close()` alone can leave the last one unfinished. A context that will not close is a
 * problem in the log, and the build then fails on its missing or empty video.
 */
export async function finishGuideRecording(): Promise<void> {
  if (!isRecordingGuide()) return;
  for (const context of [...contexts]) {
    await context.close().catch((thrown: unknown) => problem(`a recorded context did not close, its video may be unfinished: ${firstLineOf(thrown)}`));
  }
  log.info(`recording finished — timeline in ${join(recordingFolder(), TIMELINE_FILE)}`);
}
