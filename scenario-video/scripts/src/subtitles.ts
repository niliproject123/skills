// The .srt beside each video: the same captions the viewer reads on the strip, on the video's own
// clock after the cut — for a player's subtitle track, for search, for a screen reader.
import { writeFileSync } from 'node:fs';

export interface Cue {
  startMs: number;
  endMs: number;
  text: string;
}

const EMBED_RIGHT_TO_LEFT = String.fromCharCode(0x202b);
const END_EMBEDDING = String.fromCharCode(0x202c);

function srtTime(ms: number): string {
  const whole = Math.max(0, Math.round(ms));
  const hours = Math.floor(whole / 3_600_000);
  const minutes = Math.floor((whole % 3_600_000) / 60_000);
  const seconds = Math.floor((whole % 60_000) / 1000);
  const rest = whole % 1000;
  const two = (value: number): string => String(value).padStart(2, '0');
  return `${two(hours)}:${two(minutes)}:${two(seconds)},${String(rest).padStart(3, '0')}`;
}

/**
 * Cues shorter than a tenth of a second are not written: nobody reads them. Returns how many were.
 *
 * Right to left: players lay a subtitle line out left to right unless told otherwise, which moves a
 * Hebrew line's closing quote or full stop to the wrong end. Each rtl line is wrapped in a
 * right-to-left embedding (U+202B … U+202C), which every common player honours.
 */
export function writeSubtitles(file: string, cues: readonly Cue[], direction: 'rtl' | 'ltr'): number {
  const line = (text: string): string => (direction === 'rtl' ? `${EMBED_RIGHT_TO_LEFT}${text.trim()}${END_EMBEDDING}` : text.trim());
  const kept = cues.filter((cue) => cue.endMs - cue.startMs >= 100 && cue.text.trim() !== '');
  const body = kept
    .map((cue, index) => `${index + 1}\n${srtTime(cue.startMs)} --> ${srtTime(cue.endMs)}\n${line(cue.text)}\n`)
    .join('\n');
  writeFileSync(file, body, 'utf8');
  return kept.length;
}
