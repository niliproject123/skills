// Every word the strip shows comes from one dictionary file (`dictionary.he.json`, `dictionary.en.json`,
// or the user's own copy). No strip text is written in code. A file missing a key, carrying an unknown
// key, or holding an empty value refuses the walk at start — a missing word is not replaced by English.
import { readFileSync } from 'node:fs';
import { WalkError } from './types';

export const WORD_KEYS = [
  // the strip's controls (drawn by the page script)
  'next', 'auto', 'confirmAuto', 'pause', 'modeStepByStep', 'modeWaiting', 'back', 'here', 'stepsList',
  'fold', 'foldedTab', 'foldedTabWaiting', 'movingBack', 'returning', 'currentMark',
  // the strip's title line
  'stepNumbered', 'stepUnnumbered', 'titleLine', 'beforeStep', 'afterDone', 'afterFailed',
  // the result line under the description
  'failedChecks', 'notCheckedNote', 'browserError', 'closingChecks',
  // the change of person
  'changeOfPerson', 'changeCaptionSwitch', 'changeCaptionFirst', 'nowSignedIn', 'nobodySignedIn',
  // the steps list
  'chooseStartStrip', 'chooseStartCaption', 'chooseStartTitle', 'stepsListTitle', 'stepMark', 'unnumberedMark',
  // scroll per step
  'scrolled', 'scrollNotMeasured',
  // back navigation
  'noEarlierPlace', 'otherPersonsPlace', 'backAt', 'hereAt', 'herePage', 'stepAgain', 'couldNotReach', 'insideOpened',
] as const;

export type WordKey = (typeof WORD_KEYS)[number];
export type Dictionary = Record<WordKey, string>;

/** The words the page script draws itself — handed to `walkOverlayScript`. */
export type OverlayWords = Pick<Dictionary,
  'next' | 'auto' | 'confirmAuto' | 'pause' | 'modeStepByStep' | 'modeWaiting' | 'back' | 'here' | 'stepsList'
  | 'fold' | 'foldedTab' | 'foldedTabWaiting' | 'movingBack' | 'returning' | 'currentMark'>;

export function loadDictionary(file: string): Dictionary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (thrown) {
    throw new WalkError('dictionary.unreadable', `the dictionary ${file} could not be read as JSON: ${String(thrown)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new WalkError('dictionary.not_an_object', `the dictionary ${file} is not a JSON object of words`);
  }
  const given = parsed as Record<string, unknown>;
  const known = new Set<string>(WORD_KEYS);
  const missing = WORD_KEYS.filter((key) => typeof given[key] !== 'string' || (given[key] as string).trim() === '');
  const unknown = Object.keys(given).filter((key) => !known.has(key) && !key.startsWith('//'));
  if (missing.length > 0 || unknown.length > 0) {
    throw new WalkError('dictionary.keys', `the dictionary ${file} — ${missing.length ? `missing or empty: ${missing.join(', ')}` : ''}${missing.length && unknown.length ? '; ' : ''}${unknown.length ? `not a known key: ${unknown.join(', ')}` : ''}`);
  }
  return Object.fromEntries(WORD_KEYS.map((key) => [key, given[key] as string])) as Dictionary;
}

/** The word with its `{placeholders}` filled. A placeholder left unfilled is an error, not a blank. */
export function say(words: Dictionary, key: WordKey, values: Record<string, string | number> = {}): string {
  const filled = words[key].replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = values[name];
    if (value === undefined) throw new WalkError('dictionary.placeholder', `the word "${key}" needs {${name}} and was not given it`);
    return String(value);
  });
  return filled;
}

export function overlayWords(words: Dictionary): OverlayWords {
  return {
    next: words.next, auto: words.auto, confirmAuto: words.confirmAuto, pause: words.pause,
    modeStepByStep: words.modeStepByStep, modeWaiting: words.modeWaiting, back: words.back, here: words.here,
    stepsList: words.stepsList, fold: words.fold, foldedTab: words.foldedTab, foldedTabWaiting: words.foldedTabWaiting,
    movingBack: words.movingBack, returning: words.returning, currentMark: words.currentMark,
  };
}
