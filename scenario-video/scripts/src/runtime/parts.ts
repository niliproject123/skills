// A scenario as a chain of named parts, and running only some of them — SCENARIO_PARTS.
//
// A scenario is a story told in order. Re-running the whole story to look at one part costs
// minutes, and commenting the others out is how checks go missing for good. So a scenario declares
// its parts, each with the parts it needs before it, and SCENARIO_PARTS picks:
//
//   SCENARIO_PARTS unset          every part, in order
//   SCENARIO_PARTS=send-invite    its needs first (logged as prerequisites), then send-invite
//   SCENARIO_PARTS=sign-in        the startup alone — proves the seed and every sign-in
//
// `needs` is required: `[]` says the part's starting point comes from the seed. A need is never
// silently skipped, an unknown key fails with the known ones, and a need is declared earlier.
import { VideoError } from '../errors';

export const SIGN_IN_ONLY = 'sign-in';
export const PARTS_VARIABLE = 'SCENARIO_PARTS';

export interface PartDeclaration {
  /** Lower-case words joined by hyphens: `send-invite`. What SCENARIO_PARTS names. */
  key: string;
  /**
   * What a viewer is told this step is — the title card, and the name the plan's rules and
   * chapters match against. Written in the caption language.
   */
  title: string;
  /** Where things stand during this step, one line under the title: `Project: draft → submitted`. */
  subtitle?: string;
  needs: readonly string[];
}

export interface PartsPlan {
  asked: string[] | null;
  toRun: string[];
  prerequisites: string[];
  skipped: string[];
  finished: string[];
  runs: (key: string) => boolean;
}

const KEY_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function partsAsked(): string[] | null {
  const value = process.env[PARTS_VARIABLE];
  if (value === undefined || value.trim() === '') return null;
  return value.split(',').map((key) => key.trim());
}

/** Check the declarations and work out what runs. Throws, naming the problem, rather than guessing. */
export function planParts(parts: readonly PartDeclaration[], asked: string[] | null): PartsPlan {
  const refuse = (code: string, message: string): never => {
    throw new VideoError(code, message);
  };
  const keys = parts.map((part) => part.key);
  parts.forEach((part, index) => {
    if (!KEY_SHAPE.test(part.key) || part.key === SIGN_IN_ONLY) refuse('parts.bad_key', `part key "${part.key}" — lower-case words joined by hyphens, and not "${SIGN_IN_ONLY}"`);
    if (keys.indexOf(part.key) !== index) refuse('parts.duplicate', `part "${part.key}" is declared twice`);
    if (!part.title.trim()) refuse('parts.no_title', `part "${part.key}" has no title — the title card and the plan need one`);
    for (const need of part.needs) {
      const at = keys.indexOf(need);
      if (at === -1 || at >= index) refuse('parts.bad_need', `part "${part.key}" needs "${need}", which is ${at === -1 ? 'not a part' : 'declared after it'}`);
    }
  });
  const known = `known parts: ${SIGN_IN_ONLY} · ${keys.join(' · ')}`;
  if (asked !== null) {
    if (asked.some((key) => key === '')) refuse('parts.empty_entry', `${PARTS_VARIABLE} "${asked.join(',')}" has an empty entry — ${known}`);
    const unknown = asked.filter((key) => key !== SIGN_IN_ONLY && !keys.includes(key));
    if (unknown.length > 0) refuse('parts.unknown', `${PARTS_VARIABLE} names ${unknown.map((key) => `"${key}"`).join(', ')} — ${known}`);
    if (asked.includes(SIGN_IN_ONLY) && asked.length > 1) refuse('parts.sign_in_alone', `${PARTS_VARIABLE} "${SIGN_IN_ONLY}" stands alone`);
  }
  const wanted = new Set<string>();
  const add = (key: string): void => {
    if (wanted.has(key)) return;
    wanted.add(key);
    for (const need of parts.find((part) => part.key === key)?.needs ?? []) add(need);
  };
  const askedParts = asked === null ? keys : asked.filter((key) => key !== SIGN_IN_ONLY);
  askedParts.forEach(add);
  const toRun = keys.filter((key) => wanted.has(key));
  return {
    asked,
    toRun,
    prerequisites: toRun.filter((key) => !askedParts.includes(key)),
    skipped: keys.filter((key) => !wanted.has(key)),
    finished: [],
    runs: (key) => wanted.has(key),
  };
}

export function partsSummary(plan: PartsPlan): string {
  const notReached = plan.toRun.filter((key) => !plan.finished.includes(key));
  const signInOnly = plan.asked?.includes(SIGN_IN_ONLY) ?? false;
  return [
    signInOnly ? `parts: ${SIGN_IN_ONLY} only — startup, no part` : `parts ran: ${plan.finished.join(', ') || 'none'}`,
    plan.prerequisites.length ? `prerequisites: ${plan.prerequisites.join(', ')}` : '',
    plan.skipped.length ? `skipped: ${plan.skipped.join(', ')}` : '',
    notReached.length ? `not reached: ${notReached.join(', ')}` : '',
  ].filter(Boolean).join(' · ');
}
