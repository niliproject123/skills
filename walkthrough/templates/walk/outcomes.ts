// Racing named outcomes, so every wait ends for a named reason — and the losers stop with the race.
//
// A bare `waitFor` ends one way: the thing appeared, or "Timeout 30000ms exceeded", which names nothing.
// Here every way a wait can end has a name, they are raced, and the ceiling is one of the racers.
//
// The losers: a Playwright wait takes no abort signal, so a losing `waitFor({ timeout: 60_000 })` keeps
// running after the race is decided and, a minute later, logs a Timeout into a run that has moved on —
// it read as a second failure in a walk that had passed. Each outcome is handed the race's signal;
// `untilRaceEnds` takes a wait in one-second slices and stops between slices once the signal is aborted.
// A loser that ignores the signal and fails after the verdict is still logged by name, never dropped.
//
//   const ended = await step.race('the invitation is sent', [
//     { name: 'sent',    wait: (over) => untilRaceEnds(over, 20_000, (ms) => page.getByTestId('sent').waitFor({ timeout: ms })) },
//     { name: 'refused', wait: (over) => untilRaceEnds(over, 20_000, (ms) => page.getByRole('alert').waitFor({ timeout: ms })) },
//   ], 20_000);
//   step.checks.check('R2', 'the invitation is sent', ended.name === 'sent', { expected: 'sent', received: ended.name });
import { errors } from 'playwright';
import { firstLineOf, WalkError, type NamedOutcome, type Settled } from './types';

export const CEILING = 'ceiling';
const RACE_ENDED = 'race.ended';

const isRaceEnded = (thrown: unknown): boolean => thrown instanceof WalkError && thrown.code === RACE_ENDED;

/** A Playwright wait taken in slices; stops quietly once the race is decided, throws by name at its own deadline. */
export async function untilRaceEnds<T>(raceEnded: AbortSignal, timeoutMs: number, attempt: (sliceMs: number) => Promise<T>, sliceMs = 1_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (raceEnded.aborted) throw new WalkError(RACE_ENDED, 'the race this wait ran in was decided — the wait stopped with it');
    const left = deadline - Date.now();
    if (left <= 0) throw new WalkError('race.wait_timed_out', `the wait did not end within ${timeoutMs} ms`);
    try {
      return await attempt(Math.min(sliceMs, left));
    } catch (thrown) {
      if (!(thrown instanceof errors.TimeoutError)) throw thrown;
    }
  }
}

/**
 * The winner's name, logged. A racer that rejects before the verdict rejects the race (a broken wait is an
 * error, not an ending); after it, it is logged as the losing branch. The ceiling wins by name and does not
 * throw: for a "nothing must appear" wait it is the pass, so the caller decides.
 */
export async function raceOutcomes<T>(log: (message: string) => void, what: string, outcomes: NamedOutcome<T>[], ceilingMs: number): Promise<Settled<T>> {
  if (outcomes.length === 0) throw new WalkError('race.no_outcomes', `race "${what}" was given no outcomes`);
  if (outcomes.some((outcome) => outcome.name === CEILING)) throw new WalkError('race.name_clash', `an outcome of "${what}" may not be named "${CEILING}"`);
  const started = Date.now();
  const raceEnded = new AbortController();
  let won: { name: string; value: T | undefined; ceiling: boolean } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const decided = new Promise<void>((resolve, reject) => {
    for (const outcome of outcomes) {
      void outcome.wait(raceEnded.signal).then(
        (value) => {
          if (won) return;
          won = { name: outcome.name, value, ceiling: false };
          resolve();
        },
        (thrown: unknown) => {
          if (won && isRaceEnded(thrown)) return; // cancelled by the verdict: not an ending
          if (won) {
            log(`the losing branch "${outcome.name}" of "${what}" ended with: ${firstLineOf(thrown)}`);
            return;
          }
          reject(new WalkError('race.outcome_failed', `the outcome "${outcome.name}" of "${what}" failed while racing: ${firstLineOf(thrown)}`));
        },
      );
    }
    timer = setTimeout(() => {
      if (won) return;
      won = { name: CEILING, value: undefined, ceiling: true };
      resolve();
    }, ceilingMs);
  });
  try {
    await decided;
  } finally {
    if (timer) clearTimeout(timer);
    raceEnded.abort();
  }
  const winner = won as { name: string; value: T | undefined; ceiling: boolean } | null;
  if (!winner) throw new WalkError('race.no_winner', `the race "${what}" ended without a named winner`);
  const seconds = Number(((Date.now() - started) / 1000).toFixed(1));
  log(`${what}: ${winner.ceiling ? `nothing settled within ${(ceilingMs / 1000).toFixed(1)}s — the ceiling ended it` : `settled as "${winner.name}"`} after ${seconds}s`);
  return { ...winner, seconds };
}
