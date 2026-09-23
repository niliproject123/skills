// The shape of a guide plan: how the scenario is run, which person's recording becomes which video,
// what a guide leaves out of a test, and — optionally — the chapters with their side notes.
// One plan per scenario, `<scenarios folder>/<name>.plan.ts`.
//
// A plan matches the scenario's own words — its step titles and what it says it pressed — never a
// time or a count of clicks. When a test changes, the plan changes only where a *kind* of action
// changes: a new check-only visit to leave out, a new repeated action to thin.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { VideoError } from './errors';
import type { CaptionRuleWritten, CaptionWords } from './captions';
import type { Look } from './overlay';

export interface LeaveOut {
  /** The step, by the scenario's title for it. Absent: every step. */
  step?: RegExp;
  /** The scenario's words for the action. */
  what: RegExp;
  /** Written into the video log beside every action this rule removed. */
  why: string;
}

export interface KeepAtMost {
  what: RegExp;
  /** How many of these are kept in each step; the rest are cut out of the video. */
  count: number;
  why: string;
}

export interface GuideVideo {
  /** File name without extension, ascii: `01_manager`. */
  file: string;
  /**
   * The person whose screen this video is — or several, for a video that follows one story through
   * everybody in it. With several, clips are joined in wall-clock order: the film cuts to whoever
   * acts next instead of playing one person's whole run and then the next person's.
   */
  who: string | readonly string[];
  /** What the video is, in the viewer's words — the video log lists it. */
  title: string;
  /** Only these steps. Absent: every step the person acts in. */
  steps?: RegExp;
  leaveOut: LeaveOut[];
  keepAtMost: KeepAtMost[];
}

/**
 * What a chapter says beyond what the screen shows. Absent for a step: nothing extra is drawn.
 *
 *   • the **title card** before the chapter carries the step title, `people`, `sideNotes` and
 *     `slideNotes` — three seconds is long enough to read a heading and a cast, so it may be long;
 *   • the **strip** carries every `sideNotes` entry for the whole chapter, one phrase per line
 *     (44 characters; a longer one is logged as a problem and cut with an ellipsis on screen).
 *
 * Chapters are shown to the person and approved before recording — see `chapterApproval`.
 */
export interface Chapter {
  /** The step this belongs to, by the scenario's own title for it. First match wins. */
  step: RegExp;
  people?: readonly string[];
  /** One phrase each: `Status: Submitted`, `Reply due in 5 days`. On the card and on the strip. */
  sideNotes?: readonly string[];
  /** Longer notes, on the card only — what the system deliberately does *not* do belongs here. */
  slideNotes?: readonly string[];
}

/** A caption for a shape of label: `{ kind: 'press', match: /^Tab (.+)$/, say: 'Open the “$1” tab' }`. */
export interface CaptionRule {
  kind: 'press' | 'fill';
  match: RegExp;
  say: string;
}

export type HowToRun =
  /** A scenario written with this skill's runtime, relative to the scenarios folder. */
  | { scenario: string }
  /** Any other command, from the repository root — an existing Playwright test, for one. */
  | { command: readonly [string, ...string[]] };

export interface GuidePlan {
  /** The name `make.ts` is called with. */
  name: string;
  run: HowToRun;
  /** Overrides the settings' seed for this scenario; `false` runs none. */
  seed?: { command: string } | false;
  videos: GuideVideo[];
  chapters?: readonly Chapter[];
  /**
   * Who approved the chapters and side notes, and when. Required whenever `chapters` is set:
   * `make.ts` refuses to record chapters nobody approved, because they are words put in the
   * product's mouth.
   */
  chapterApproval?: { approvedBy: string; approvedOn: string };
  captionRules?: readonly CaptionRule[];
}

// --- the recording plan: what the recorder inside the scenario's process reads ------------------

/** Written by `make.ts` into the recording folder; read by the recorder in the scenario process. */
export const RECORDING_PLAN_FILE = 'recording-plan.json';

export interface WrittenPattern {
  source: string;
  flags: string;
}

export interface ChapterWritten {
  step: WrittenPattern;
  people: string[];
  sideNotes: string[];
  slideNotes: string[];
}

export interface RecordingPlan {
  planName: string;
  language: string;
  words: CaptionWords;
  look: Look;
  chapters: ChapterWritten[];
  captionRules: CaptionRuleWritten[];
}

export const writtenPattern = (pattern: RegExp): WrittenPattern => ({ source: pattern.source, flags: pattern.flags });
export const patternFrom = (written: WrittenPattern): RegExp => new RegExp(written.source, written.flags);

export function chaptersWritten(plan: GuidePlan): ChapterWritten[] {
  return (plan.chapters ?? []).map((chapter) => ({
    step: writtenPattern(chapter.step),
    people: [...(chapter.people ?? [])],
    sideNotes: [...(chapter.sideNotes ?? [])],
    slideNotes: [...(chapter.slideNotes ?? [])],
  }));
}

export function captionRulesWritten(plan: GuidePlan): CaptionRuleWritten[] {
  return (plan.captionRules ?? []).map((rule) => ({ kind: rule.kind, match: writtenPattern(rule.match), say: rule.say }));
}

export function writeRecordingPlan(folder: string, recordingPlan: RecordingPlan): void {
  writeFileSync(join(folder, RECORDING_PLAN_FILE), JSON.stringify(recordingPlan, null, 2));
}

export function readRecordingPlan(folder: string): RecordingPlan {
  const file = join(folder, RECORDING_PLAN_FILE);
  if (!existsSync(file)) {
    throw new VideoError('recording.no_plan', `${file} is missing — a recording is started by make.ts, which writes it; the recorder cannot draw captions or chapters without it`);
  }
  return JSON.parse(readFileSync(file, 'utf8')) as RecordingPlan;
}

/** The plan's own mistakes, found before a minute of recording is spent on them. */
export function checkPlan(plan: GuidePlan): void {
  const refuse = (message: string): never => {
    throw new VideoError('plan.invalid', `plan "${plan.name}": ${message}`);
  };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(plan.name)) refuse('name is lower-case words joined by hyphens');
  if (plan.videos.length === 0) refuse('names no video');
  const files = new Set<string>();
  for (const video of plan.videos) {
    if (!/^[A-Za-z0-9_-]+$/.test(video.file)) refuse(`video file "${video.file}" is ascii letters, digits, _ and - only`);
    if (files.has(video.file)) refuse(`video file "${video.file}" is named twice`);
    files.add(video.file);
    const people = typeof video.who === 'string' ? [video.who] : video.who;
    if (people.length === 0) refuse(`video "${video.file}" follows nobody`);
    for (const rule of video.keepAtMost) if (rule.count < 1) refuse(`keepAtMost ${rule.what} in "${video.file}" keeps ${rule.count} — at least 1`);
  }
  if ((plan.chapters ?? []).length > 0) {
    const approval = plan.chapterApproval;
    if (!approval || !approval.approvedBy.trim() || !approval.approvedOn.trim()) {
      refuse('has chapters and no chapterApproval — show the chapters and their notes to the person, and record who approved them and when');
    }
  }
}
