// Racing named outcomes, so every wait ends for a named reason.
//
// A bare `waitFor` ends one way: the thing appeared, or a timeout that names nothing. It does not
// say whether the screen refused, is still loading, or never got an answer. Here every way a wait
// can end has a name, they are raced, and the ceiling is one of the racers — "nothing happened" is
// itself a named ending rather than an exception from somewhere inside Playwright.
//
//   const ended = await s.race('the invitation is sent', [
//     { name: 'sent',    wait: () => dana.waitFor({ text: 'Invitation sent' }) },
//     { name: 'refused', wait: () => dana.waitFor({ role: 'alert', name: /already/ }) },
//   ], 20_000);
//   s.check('the invitation was sent', ended.name === 'sent', `ended as ${ended.name}`);
import { firstLineOf, VideoError } from '../errors';

export interface NamedOutcome<T> {
  name: string;
  wait: () => Promise<T>;
}

export interface Settled<T> {
  /** The winning outcome's name, or `ceiling` when nothing settled. */
  name: string;
  value: T | undefined;
  seconds: number;
  ceiling: boolean;
}

export const CEILING = 'ceiling';

type Log = (actor: string, message: string) => void;

/**
 * A racer that rejects before the race is decided rejects the race, carrying its name — a broken
 * wait is an error, not an ending. One that rejects after is logged as the losing branch and goes
 * no further. The ceiling wins by name and does not throw: for a "nothing must appear" wait it is
 * the pass, so the caller decides.
 */
export async function raceOutcomes<T>(log: Log, what: string, outcomes: NamedOutcome<T>[], ceilingMs = 30_000): Promise<Settled<T>> {
  if (outcomes.length === 0) throw new VideoError('race.no_outcomes', `race "${what}" was given no outcomes`);
  if (outcomes.some((outcome) => outcome.name === CEILING)) throw new VideoError('race.name_clash', `an outcome may not be named "${CEILING}" — that is the race's own ceiling`);
  const started = Date.now();
  let won: { name: string; value: T | undefined; ceiling: boolean } | null = null;
  let ceilingTimer: ReturnType<typeof setTimeout> | undefined;
  const decided = new Promise<void>((resolve, reject) => {
    for (const outcome of outcomes) {
      void outcome.wait().then(
        (value) => {
          if (won) return;
          won = { name: outcome.name, value, ceiling: false };
          resolve();
        },
        (thrown: unknown) => {
          if (won) {
            log('race', `the losing branch "${outcome.name}" of "${what}" ended with: ${firstLineOf(thrown)}`);
            return;
          }
          reject(new VideoError('race.outcome_failed', `the outcome "${outcome.name}" of "${what}" failed while racing: ${firstLineOf(thrown)}`));
        },
      );
    }
    ceilingTimer = setTimeout(() => {
      if (won) return;
      won = { name: CEILING, value: undefined, ceiling: true };
      resolve();
    }, ceilingMs);
  });
  try {
    await decided;
  } finally {
    if (ceilingTimer) clearTimeout(ceilingTimer);
  }
  const winner = won as { name: string; value: T | undefined; ceiling: boolean } | null;
  if (!winner) throw new VideoError('race.no_winner', `the race "${what}" ended without a named winner`);
  const seconds = Number(((Date.now() - started) / 1000).toFixed(1));
  log('race', `${what}: ${winner.ceiling ? `nothing settled within ${(ceilingMs / 1000).toFixed(1)}s — the ceiling ended it` : `settled as "${winner.name}"`} after ${seconds}s`);
  return { ...winner, seconds };
}
