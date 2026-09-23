// The caption a viewer reads, made from the scenario's own words for a control.
//
// A scenario names what it presses — a label, a test id, a role and name. A caption is the same
// thing said to a person: `Click "Save"` / `לוחצים על ״שמירה״`. The words come from the language in
// the settings; a plan may add rules for a *shape* of label (`^Tab (.+)$` → `Open the "$1" tab`).
// A caption that still reads like a developer's word — a selector, an identifier, English on a
// Hebrew screen — is flagged in the video log so it gets a rule or a better label, never shipped.
import { VideoError } from './errors';

export interface CaptionWords {
  /** `{name}` is the control's words. */
  press: string;
  /** `{name}` is the field's label. */
  fill: string;
  /** Written before the list of people on a chapter's title card. */
  people: string;
}

/** Built in for these languages; any other language brings all three in `captions.words`. */
export const BUILT_IN_WORDS: Readonly<Record<string, CaptionWords>> = {
  he: { press: 'לוחצים על ״{name}״', fill: 'ממלאים את ״{name}״', people: 'משתתפים: ' },
  en: { press: 'Click “{name}”', fill: 'Fill in “{name}”', people: 'People: ' },
};

export function wordsFor(language: string, overrides: Partial<CaptionWords> | undefined): CaptionWords {
  const base = BUILT_IN_WORDS[language];
  const merged = { ...(base ?? {}), ...(overrides ?? {}) } as Partial<CaptionWords>;
  const missing = (['press', 'fill', 'people'] as const).filter((key) => typeof merged[key] !== 'string');
  if (missing.length > 0) {
    throw new VideoError(
      'captions.no_words',
      `captions.language is "${language}", which has no built-in words (${Object.keys(BUILT_IN_WORDS).join(', ')}) — add captions.words.${missing.join(', captions.words.')} to the settings`,
    );
  }
  for (const key of ['press', 'fill'] as const) {
    if (!(merged[key] as string).includes('{name}')) throw new VideoError('captions.no_name_slot', `captions.words.${key} must contain {name}`);
  }
  return merged as CaptionWords;
}

/** A plan's caption rule, after it was written to JSON: `$1`… in `say` are the pattern's groups. */
export interface CaptionRuleWritten {
  kind: 'press' | 'fill';
  match: { source: string; flags: string };
  say: string;
}

function byRule(kind: 'press' | 'fill', name: string, rules: readonly CaptionRuleWritten[]): string | null {
  for (const rule of rules) {
    if (rule.kind !== kind) continue;
    const found = new RegExp(rule.match.source, rule.match.flags).exec(name);
    if (found) return rule.say.replace(/\$(\d)/g, (_all, group: string) => found[Number(group)] ?? '');
  }
  return null;
}

export function captionForPress(name: string, words: CaptionWords, rules: readonly CaptionRuleWritten[]): string {
  const bare = name.trim();
  return byRule('press', bare, rules) ?? words.press.replace('{name}', bare);
}

export function captionForFill(name: string, words: CaptionWords, rules: readonly CaptionRuleWritten[]): string {
  const bare = name.trim();
  return byRule('fill', bare, rules) ?? words.fill.replace('{name}', bare);
}

/** The letters of a right-to-left language — a caption with none of them was not translated. */
const SCRIPT_OF: Readonly<Record<string, RegExp>> = {
  he: /[֐-׿]/,
  ar: /[؀-ۿ]/,
  fa: /[؀-ۿ]/,
};
const QUOTED = /[״“"«]([^״”"»]+)[״”"»]/g;
/** A selector, an identifier in camelCase or snake_case — words a developer wrote for a machine. */
const DEVELOPER_WORD = /[[\]=#>]|^[a-z]+(?:[A-Z][a-z0-9]*)+$|^[a-z0-9]+(?:[_-][a-z0-9]+)+$/;

/**
 * True when a caption still carries a developer's word. For a language with its own script: no
 * letter of it at all, or a quoted part that is Latin only. For any language: a quoted part (or
 * the whole caption) that looks like a selector or an identifier.
 */
export function captionLooksRaw(caption: string, language: string): boolean {
  const quoted = [...caption.matchAll(QUOTED)].map((match) => match[1] ?? '');
  const script = SCRIPT_OF[language];
  if (script) {
    if (!script.test(caption)) return true;
    if (quoted.some((part) => /[A-Za-z]/.test(part) && !script.test(part))) return true;
  }
  const parts = quoted.length > 0 ? quoted : [caption];
  return parts.some((part) => DEVELOPER_WORD.test(part.trim()));
}
