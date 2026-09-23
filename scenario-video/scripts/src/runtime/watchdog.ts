// The watchdog: a diagnostic sample of the page each second; a run of identical samples is a stall,
// and the run ends for that named reason instead of hanging or dying on a timeout that names one
// selector. It is a *signature*, not a heartbeat: a run waiting for an answer that never comes and a
// run doing slow but real work look different, because the second keeps logging and changing.
import type { Page } from 'playwright';
import { firstLineOf, VideoError } from '../errors';

export interface WatchdogOptions {
  /** How often it samples. Default 1000ms. */
  everyMs?: number;
  /** How many identical samples in a row are a stall. Default 30. */
  stallTicks?: number;
}

export interface Watchdog {
  /** Rejects the moment a stall is declared. The runtime races the scenario against it. */
  stalled: Promise<never>;
  stop: () => void;
  ticks: () => number;
  everyMs: number;
  /** The last samples, newest last. */
  dump: (howMany?: number) => string[];
  /**
   * Run `work` with sampling suspended, and count from zero afterwards. For one thing only: closing
   * a recorded browser context, which flushes a whole video file and freezes the page while it does.
   * That is the run finishing, not stalling. A wait on the app is exactly what the watchdog is for.
   */
  hold: <T>(what: string, work: () => Promise<T>) => Promise<T>;
  stall: () => string | null;
}

export interface WatchdogSource {
  /** The page being acted on now — read on every sample, because the actor changes. */
  page: () => Page | null;
  log: (actor: string, message: string) => void;
  /** Counters the runtime keeps, so traffic and log lines count as movement. */
  counters: () => Record<string, number>;
}

const KEPT = 40;

export function startWatchdog(source: WatchdogSource, options: WatchdogOptions = {}): Watchdog {
  const everyMs = options.everyMs ?? 1_000;
  const stallTicks = options.stallTicks ?? 30;
  if (stallTicks < 2) throw new VideoError('watchdog.ceiling_too_low', `stallTicks is ${stallTicks} — a stall needs at least two identical samples to compare`);

  const samples: string[] = [];
  let ticks = 0;
  let unchanged = 0;
  let last = '';
  let stall: string | null = null;
  let held = 0;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let declare: ((reason: VideoError) => void) | undefined;
  const stalled = new Promise<never>((_resolve, reject) => {
    declare = reject;
  });
  // The runtime races the scenario against this; until then an early rejection must not be unhandled.
  void stalled.catch(() => undefined);

  const read = async (): Promise<string> => {
    const page = source.page();
    let screen: Record<string, unknown> = { page: 'none open yet' };
    if (page) {
      try {
        screen = await page.evaluate(() => ({
          url: location.href,
          ready: document.readyState,
          nodes: document.querySelectorAll('*').length,
          chars: (document.body?.innerText ?? '').length,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        }));
      } catch (thrown) {
        // A sample across a navigation loses its context — recorded as a diagnostic, and it counts as movement.
        screen = { sampleFailed: firstLineOf(thrown) };
      }
    }
    return JSON.stringify({ ...screen, ...source.counters() });
  };

  const stopSampling = (): void => {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = undefined;
  };

  const tick = async (): Promise<void> => {
    if (stopped || stall || held > 0) return;
    const now = await read();
    ticks += 1;
    samples.push(`#${ticks} ${now}`);
    while (samples.length > KEPT) samples.shift();
    unchanged = now === last ? unchanged + 1 : 0;
    last = now;
    if (unchanged < stallTicks) return;
    stall = `the run stalled: ${unchanged + 1} identical samples over ${((unchanged + 1) * everyMs) / 1000}s — nothing on the page, in the traffic or in the log moved`;
    source.log('watchdog', stall);
    for (const line of samples.slice(-Math.min(stallTicks + 1, KEPT))) source.log('watchdog', line);
    stopSampling();
    declare?.(new VideoError('scenario.stalled', stall, { ticks, lastSample: last }));
  };

  timer = setInterval(() => {
    void tick().catch((thrown: unknown) => source.log('watchdog', `the watchdog could not sample: ${firstLineOf(thrown)}`));
  }, everyMs);
  timer.unref?.();

  return {
    stalled,
    stop: stopSampling,
    ticks: () => ticks,
    everyMs,
    dump: (howMany = 10) => samples.slice(-howMany),
    hold: async <T>(what: string, work: () => Promise<T>): Promise<T> => {
      held += 1;
      source.log('watchdog', `not sampling while ${what}`);
      try {
        return await work();
      } finally {
        held -= 1;
        unchanged = 0;
        last = '';
        source.log('watchdog', `sampling again after ${what}`);
      }
    },
    stall: () => stall,
  };
}
