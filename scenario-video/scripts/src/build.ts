// Cut a recording into guide videos, and write the video log beside them.
//
// Input, all in the recording folder (`recorder.ts` and `make.ts` write them):
//   run-result.json   how the scenario ended, and with what
//   pages.jsonl       each person's page, and the raw video it recorded to
//   timeline.jsonl    every title card, press, fill and watch, on that page's video clock
//   problems.jsonl    what went wrong while recording (absent when nothing did)
// Output: `videos/<file>.mp4` and `videos/<file>.srt` per video of the plan, and `video-log.md`.
//
// What is kept (per page, in order): a press unless a `leaveOut` or `keepAtMost` rule cuts it; a
// fill follows its press — typed into a form whose opening was cut, it is cut too; a title card when
// its step kept anything. Each kept event becomes a clip from just before it to the next event on
// that page, or HOLD_MS, whichever is first — so the waits between actions are not in the video.
import ffmpegPath from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captionLooksRaw } from './captions';
import { VideoError } from './errors';
import { Logger } from './log';
import type { GuidePlan, GuideVideo } from './plan';
import { patternFrom, readRecordingPlan } from './plan';
import { CARD_FADE_MS, PAGES_FILE, PROBLEMS_FILE, TIMELINE_FILE, TITLE_CARD_MS, type GuideEvent, type GuidePage } from './recorder';
import { writeSubtitles, type Cue } from './subtitles';

/** A clip starts this long before its event: the pointer's first move. */
const LEAD_MS = 400;
/** A clip runs at most this long after its event when nothing else happens on that page sooner —
 *  long enough to read what a press did, short enough that the waiting is cut out, not filmed. */
const HOLD_MS = 2_000;
/** Two clips closer than this are one clip — no flicker of a cut. */
const JOIN_GAP_MS = 300;
/** Every clip is re-encoded at this rate, so clips of different recordings join cleanly. */
const FRAMES_PER_SECOND = 25;
export const RUN_RESULT_FILE = 'run-result.json';
export const VIDEO_LOG_FILE = 'video-log.md';

export interface RunResult {
  scenario: string;
  command: string[];
  exitCode: number | null;
  runId: string;
  appAddress: string;
  seedCommand: string;
  startedAt: string;
  endedAt: string;
  branch: string;
  commit: string;
  /** Set only when the person running it said a failed run may still become a video. */
  acceptedFailedRun: boolean;
}

interface Decision {
  event: GuideEvent;
  kept: boolean;
  why: string;
}

interface Clip {
  startMs: number;
  endMs: number;
  /** Wall clock of the first event — how clips of different people are put in order. */
  atEpochMs: number;
  /** The kept events inside it, in order — the subtitles are made from these. */
  events: GuideEvent[];
}

const log = new Logger('scenario-video');

function readJsonLines<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

/** The ffmpeg binary, or a named error — checked before a recording starts, not after it. */
export function ffmpegBinary(): string {
  if (!ffmpegPath) throw new VideoError('ffmpeg.no_binary', 'ffmpeg-static has no binary for this platform — its npm install reported why, or its download was skipped');
  const path = ffmpegPath as unknown as string;
  if (!existsSync(path)) throw new VideoError('ffmpeg.missing_file', `ffmpeg-static points at ${path}, which does not exist — run npm install again in the tools folder and read its output`);
  return path;
}

function ffmpeg(args: string[], what: string, level = 'error'): string {
  const ran = spawnSync(ffmpegBinary(), ['-hide_banner', '-loglevel', level, '-y', ...args], { encoding: 'utf8' });
  if (ran.status !== 0) {
    throw new VideoError('ffmpeg.failed', `ffmpeg failed while ${what}: ${(ran.stderr || ran.error?.message || '').trim().slice(0, 600)}`, { what });
  }
  return ran.stderr ?? '';
}

/** How many frames a cut clip really holds — its length on the joined video's clock, measured. */
function framesIn(file: string): number {
  // Decoded, not stream-copied: only a decode reports `frame=` in ffmpeg's closing stats line.
  const said = ffmpeg(['-i', file, '-map', '0:v:0', '-f', 'null', '-'], `counting the frames of ${file}`, 'info');
  const counts = [...said.matchAll(/frame=\s*(\d+)/g)].map((match) => Number(match[1]));
  const last = counts[counts.length - 1];
  if (last === undefined) throw new VideoError('ffmpeg.no_frame_count', `ffmpeg reported no frame count for ${file} — the subtitles cannot be placed`);
  return last;
}

/** Keep or cut every event of one page, in order, by the plan's rules. */
export function decide(video: GuideVideo, events: GuideEvent[]): Decision[] {
  const decisions: Decision[] = [];
  const keptCount = new Map<string, number>();
  let lastPress: Decision | null = null;
  for (const event of events) {
    if (event.kind === 'title') {
      decisions.push({ event, kept: false, why: 'pending' });
      continue;
    }
    if (video.steps && !video.steps.test(event.step)) {
      decisions.push({ event, kept: false, why: 'step not in this video' });
      continue;
    }
    const leftOut = video.leaveOut.find((rule) => rule.what.test(event.what) && (!rule.step || rule.step.test(event.step)));
    if (leftOut) {
      const decision = { event, kept: false, why: leftOut.why };
      decisions.push(decision);
      if (event.kind !== 'fill') lastPress = decision;
      continue;
    }
    if (event.kind === 'fill') {
      const followsCut = lastPress !== null && lastPress.event.step === event.step && !lastPress.kept;
      decisions.push({ event, kept: !followsCut, why: followsCut ? `follows a cut press (${lastPress?.event.what})` : '' });
      continue;
    }
    const thinned = video.keepAtMost.find((rule) => rule.what.test(event.what));
    let decision: Decision = { event, kept: true, why: '' };
    if (thinned) {
      const key = `${thinned.what.source}|${event.step}`;
      const seen = keptCount.get(key) ?? 0;
      if (seen >= thinned.count) decision = { event, kept: false, why: `${thinned.why} (keeps ${thinned.count})` };
      else keptCount.set(key, seen + 1);
    }
    decisions.push(decision);
    lastPress = decision;
  }
  for (const decision of decisions) {
    if (decision.event.kind !== 'title') continue;
    const stepKept = decisions.some((other) => other.kept && other.event.kind !== 'title' && other.event.step === decision.event.step);
    decision.kept = stepKept;
    decision.why = stepKept ? '' : 'nothing of this step is in the video';
  }
  return decisions;
}

/** The clips of one page: each kept event to the next event on that page, or HOLD_MS; joined when they touch. */
export function clipsOf(decisions: Decision[]): Clip[] {
  const clips: Clip[] = [];
  decisions.forEach((decision, index) => {
    if (!decision.kept) return;
    const at = decision.event.atMs;
    const next = decisions[index + 1]?.event.atMs;
    const startMs = Math.max(0, at - (decision.event.kind === 'title' ? 100 : LEAD_MS));
    const endMs = decision.event.kind === 'title'
      // The card's whole life: it stands TITLE_CARD_MS and then fades; ending at the hold cuts the fade.
      ? at + TITLE_CARD_MS + CARD_FADE_MS + LEAD_MS
      : Math.max(startMs + 300, Math.min(next === undefined ? Infinity : next - LEAD_MS, at + (decision.event.holdMs ?? HOLD_MS)));
    const last = clips[clips.length - 1];
    if (last && startMs <= last.endMs + JOIN_GAP_MS) {
      last.endMs = Math.max(last.endMs, endMs);
      last.events.push(decision.event);
    } else {
      clips.push({ startMs, endMs, atEpochMs: decision.event.epochMs, events: [decision.event] });
    }
  });
  return clips;
}

/** The cues of one clip, on the joined video's clock: each caption until the next, or the clip's end. */
function cuesOf(clip: Clip, offsetMs: number, lengthMs: number): Cue[] {
  return clip.events.map((event, index) => {
    const following = clip.events[index + 1];
    const from = Math.max(0, event.atMs - clip.startMs);
    const to = Math.min(lengthMs, following ? following.atMs - clip.startMs : lengthMs);
    return { startMs: offsetMs + from, endMs: offsetMs + to, text: event.caption };
  });
}

/**
 * Cuts every clip and joins them **in the order given**. Every clip is re-encoded to the same shape,
 * which makes a join of clips from different recordings safe; each clip's real length is measured
 * in frames, so the subtitles never drift from the picture however many clips there are.
 */
function cut(clips: readonly { raw: string; clip: Clip }[], outFile: string, workFolder: string): { totalMs: number; cues: Cue[] } {
  mkdirSync(workFolder, { recursive: true });
  const parts: string[] = [];
  const cues: Cue[] = [];
  let offsetMs = 0;
  clips.forEach(({ raw, clip }, index) => {
    const part = join(workFolder, `clip_${String(index + 1).padStart(3, '0')}.mp4`);
    ffmpeg(
      ['-ss', (clip.startMs / 1000).toFixed(3), '-i', raw, '-t', ((clip.endMs - clip.startMs) / 1000).toFixed(3),
        '-vf', `fps=${FRAMES_PER_SECOND},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-an', part],
      `cutting clip ${index + 1} of ${clips.length} from ${raw}`,
    );
    const lengthMs = (framesIn(part) * 1000) / FRAMES_PER_SECOND;
    cues.push(...cuesOf(clip, offsetMs, lengthMs));
    offsetMs += lengthMs;
    parts.push(part);
  });
  const list = join(workFolder, 'clips.txt');
  writeFileSync(list, parts.map((part) => `file '${part.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', outFile], `joining ${parts.length} clips into ${outFile}`);
  rmSync(workFolder, { recursive: true, force: true });
  return { totalMs: offsetMs, cues };
}

const minutes = (ms: number): string => `${Math.floor(ms / 60_000)}:${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}`;
const cell = (text: string): string => text.replace(/\|/g, '\\|');

/** The chapters this video keeps, as the viewer was told them — read back from the recording plan. */
function chaptersOf(folder: string, steps: readonly string[]): string[] {
  const chapters = readRecordingPlan(folder).chapters;
  const declared = steps
    .map((step) => ({ step, chapter: chapters.find((written) => patternFrom(written.step).test(step)) }))
    .filter((row) => row.chapter !== undefined);
  if (declared.length === 0) return [];
  const orDash = (parts: readonly string[]): string => parts.map(cell).join('<br>') || '—';
  return [
    'Chapters — the card and the strip, from the plan:',
    '',
    '| step | people | side notes | card notes |',
    '|---|---|---|---|',
    ...declared.map(({ step, chapter }) => `| ${cell(step)} | ${orDash(chapter?.people ?? [])} | ${orDash(chapter?.sideNotes ?? [])} | ${orDash(chapter?.slideNotes ?? [])} |`),
    '',
  ];
}

export interface Built {
  videos: string[];
  subtitles: string[];
  notMade: string[];
  logFile: string;
}

export function buildGuideVideos(plan: GuidePlan, folder: string, planFile: string): Built {
  const runFile = join(folder, RUN_RESULT_FILE);
  if (!existsSync(runFile)) throw new VideoError('build.no_run_result', `${runFile} is missing — the recording was not made by make.ts, or it stopped before the scenario ran`);
  const run = JSON.parse(readFileSync(runFile, 'utf8')) as RunResult;
  if (run.exitCode !== 0 && !run.acceptedFailedRun) {
    throw new VideoError('build.failed_run', `the scenario exited ${run.exitCode} — a failed run is not made into a video. Read scenario.log, fix it and record again; or pass --accept-failed-run (the video log will say so)`, { exitCode: run.exitCode });
  }
  const pages = readJsonLines<GuidePage>(join(folder, PAGES_FILE));
  if (pages.length === 0) throw new VideoError('build.no_pages', `${join(folder, PAGES_FILE)} is missing or empty — no page was named while recording (nameGuidePage)`);
  const events = readJsonLines<GuideEvent>(join(folder, TIMELINE_FILE));
  const problems = readJsonLines<{ epochMs: number; message: string }>(join(folder, PROBLEMS_FILE));
  const language = readRecordingPlan(folder).language;
  const direction = readRecordingPlan(folder).look.direction;
  mkdirSync(join(folder, 'videos'), { recursive: true });

  const lines: string[] = [
    `# Guide videos — ${plan.name}`,
    '',
    '## What was used',
    '',
    '| | |',
    '|---|---|',
    `| scenario | \`${run.command.join(' ')}\` → exit **${run.exitCode}**${run.acceptedFailedRun ? ' — **built anyway, --accept-failed-run**' : ''} |`,
    `| run id | \`${run.runId}\` |`,
    `| seed | ${run.seedCommand ? `\`${run.seedCommand}\`` : 'none'} |`,
    `| app | ${run.appAddress} |`,
    `| branch · commit | \`${run.branch}\` · \`${run.commit}\` |`,
    `| recorded | ${run.startedAt} → ${run.endedAt} |`,
    `| cutter | ffmpeg-static \`${ffmpegBinary()}\`, H.264 CRF 22, ${FRAMES_PER_SECOND} fps |`,
    `| plan | \`${planFile.replace(/\\/g, '/')}\` |`,
    `| clip rule | ${LEAD_MS}ms before each action → the next action on that page or ${HOLD_MS}ms; title card ${TITLE_CARD_MS}ms + ${CARD_FADE_MS}ms fade |`,
    '',
    `## Problems while recording (${problems.length})`,
    '',
    ...(problems.length ? problems.map((p) => `- ${new Date(p.epochMs).toISOString()} — ${p.message}`) : ['none']),
    '',
  ];

  const peopleOf = (video: GuideVideo): readonly string[] => (typeof video.who === 'string' ? [video.who] : video.who);
  /** A page belongs to a person by exact name, or as `<person> · <qualifier>` — a second page of theirs. */
  const belongsTo = (pageWho: string, people: readonly string[]): boolean =>
    people.some((person) => pageWho === person || pageWho.startsWith(`${person} · `));
  const inVideos = plan.videos.flatMap((video) => peopleOf(video));
  const strangers = [...new Set(pages.map((page) => page.who).filter((who) => !belongsTo(who, inVideos)))];
  lines.push(`People recorded and in no video (by the plan): ${strangers.length ? strangers.join(' · ') : 'none'}`, '');

  const made: string[] = [];
  const subtitles: string[] = [];
  const notMade: string[] = [];
  const raw = new Set<string>();
  for (const video of plan.videos) {
    const people = peopleOf(video);
    const theirs = pages.filter((page) => belongsTo(page.who, people));
    lines.push(`## ${video.file} — ${video.title}`, '');
    if (theirs.length === 0) {
      const why = `nobody named "${people.join('" · "')}" was recorded — the scenario names its people differently, or never reached them`;
      lines.push(`**NOT MADE** — ${why}.`, '');
      log.error(`${video.file}: ${why}`);
      notMade.push(`${video.file}: ${why}`);
      continue;
    }
    const decisions: Decision[] = [];
    const clipsPerPage: { page: GuidePage; clips: Clip[] }[] = [];
    for (const page of theirs) {
      if (!existsSync(page.videoFile) || statSync(page.videoFile).size === 0) {
        throw new VideoError('build.raw_missing', `${page.who}'s raw video ${page.videoFile} is missing or empty — its browser context never closed`);
      }
      const pageDecisions = decide(video, events.filter((event) => event.pageId === page.pageId).sort((a, b) => a.atMs - b.atMs));
      decisions.push(...pageDecisions);
      clipsPerPage.push({ page, clips: clipsOf(pageDecisions) });
    }
    const kept = decisions.filter((decision) => decision.kept);
    if (kept.length === 0) {
      lines.push('**NOT MADE** — every recorded action was cut by the plan, or none was recorded.', '');
      log.error(`${video.file}: every action was cut`);
      notMade.push(`${video.file}: every action was cut by the plan, or none was recorded`);
      continue;
    }
    const outFile = join(folder, 'videos', `${video.file}.mp4`);
    const subtitleFile = join(folder, 'videos', `${video.file}.srt`);
    // Several people's clips interleave in the order the actions happened: the film cuts to whoever acted next.
    const inOrder = clipsPerPage
      .flatMap(({ page, clips }) => clips.map((clip) => ({ raw: page.videoFile, clip })))
      .sort((one, other) => one.clip.atEpochMs - other.clip.atEpochMs);
    const { totalMs, cues } = cut(inOrder, outFile, join(folder, 'work', video.file));
    const cueCount = writeSubtitles(subtitleFile, cues, direction);
    made.push(outFile);
    subtitles.push(subtitleFile);
    for (const page of theirs) raw.add(page.videoFile);
    lines.push(
      `**${outFile.replace(/\\/g, '/')}** — ${minutes(totalMs)}, ${inOrder.length} clip(s), ${kept.filter((d) => d.event.kind !== 'title').length} action(s) kept, ${decisions.filter((d) => !d.kept && d.event.kind !== 'title').length} cut, ${cueCount} subtitle(s).`,
      '',
      `People in this video, in the order they first act: ${[...new Set(kept.sort((a, b) => a.event.epochMs - b.event.epochMs).map((d) => d.event.who))].join(' → ')}`,
      '',
      ...chaptersOf(folder, [...new Set(kept.map((decision) => decision.event.step))]),
      '| who | step | kept | caption on screen |',
      '|---|---|---|---|',
      ...decisions
        .filter((decision) => decision.event.kind !== 'title')
        .sort((a, b) => a.event.epochMs - b.event.epochMs)
        .map((d) => `| ${cell(d.event.who)} | ${cell(d.event.step)} | ${d.kept ? 'yes' : `no — ${cell(d.why)}`} | ${cell(d.event.caption)}${captionLooksRaw(d.event.caption, language) ? ' **(reads like a developer word — add a caption rule to the plan, or a label to the control)**' : ''} |`),
      '',
    );
    log.info(`${video.file}: ${minutes(totalMs)} → ${outFile}`);
  }
  rmSync(join(folder, 'work'), { recursive: true, force: true }); // each video's own work folder is already gone
  lines.push('## Raw recordings', '', ...[...raw].map((file) => `- ${file.replace(/\\/g, '/')}`), '');
  const logFile = join(folder, VIDEO_LOG_FILE);
  writeFileSync(logFile, lines.join('\n'));
  return { videos: made, subtitles, notMade, logFile };
}
