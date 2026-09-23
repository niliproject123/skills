// The four browser listeners, on every page before its first navigation: console errors, uncaught
// page errors, failed requests, and 4xx/5xx answers from the app's own addresses. Zero are allowed.
//
// The first one buys exactly one reload of the page it happened on — a second look, never an
// amnesty: every line still counts against the exit code. Any error after that reload ends the run
// there and then. While that one reload runs, a request it aborts (ERR_ABORTED) is logged and not
// counted — that is what a reload does; nothing else is ever excused.
import type { ConsoleMessage, Page } from 'playwright';
import { firstLineOf, VideoError } from '../errors';

export interface Noise {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badAnswers: string[];
}

type Log = (actor: string, message: string) => void;

export interface NoiseWatch {
  noise: Noise;
  count: () => number;
  /** Rejects when an error repeats after the one reload. The runtime races the scenario against it. */
  stopped: Promise<never>;
  listen: (page: Page, who: string) => void;
  /** Requests answered, for the watchdog: traffic is movement. */
  answers: () => number;
}

export function watchNoise(appAddresses: readonly string[], log: Log): NoiseWatch {
  const noise: Noise = { consoleErrors: [], pageErrors: [], failedRequests: [], badAnswers: [] };
  const count = (): number => noise.consoleErrors.length + noise.pageErrors.length + noise.failedRequests.length + noise.badAnswers.length;
  let retry: 'none' | 'ordered' | 'armed' = 'none';
  let reloading = false;
  let answered = 0;
  let declare: ((thrown: VideoError) => void) | undefined;
  const stopped = new Promise<never>((_resolve, reject) => {
    declare = reject;
  });
  void stopped.catch(() => undefined);

  const reloadOnce = async (page: Page): Promise<void> => {
    const url = page.url();
    if (!url || url === 'about:blank') {
      retry = 'armed';
      log('noise', 'a browser error before the first navigation — nothing to reload; the next one ends the run');
      return;
    }
    log('noise', `a browser error — taking the one reload allowed: ${url}`);
    try {
      reloading = true;
      const reload = page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
      retry = 'armed';
      await reload;
      log('noise', 'reloaded — any further browser error now ends the run');
    } catch (thrown) {
      declare?.(new VideoError('scenario.reload_failed', `the one reload after the first browser error failed: ${firstLineOf(thrown)}`));
    } finally {
      reloading = false;
    }
  };

  const saw = (page: Page, kind: string, line: string): void => {
    log('noise', `${kind} — ${line}`);
    if (retry === 'armed') {
      declare?.(new VideoError('scenario.browser_errors', `a browser error after the one allowed reload — ${kind}: ${line}`, { kind, line }));
      return;
    }
    if (retry === 'none') {
      retry = 'ordered';
      void reloadOnce(page);
    }
  };

  const isTheApps = (url: string): boolean => appAddresses.some((address) => url.startsWith(address));

  const listen = (page: Page, who: string): void => {
    const tag = `[${who}] `;
    page.on('console', (message: ConsoleMessage) => {
      if (message.type() !== 'error') return;
      const line = `${tag}${message.text()}`;
      noise.consoleErrors.push(line);
      saw(page, 'console error', line);
    });
    page.on('pageerror', (error) => {
      const line = `${tag}${error.message}`;
      noise.pageErrors.push(line);
      saw(page, 'uncaught error', line);
    });
    page.on('requestfailed', (request) => {
      const why = request.failure()?.errorText ?? 'no reason given';
      const line = `${tag}${request.method()} ${request.url()} — ${why}`;
      if (reloading && why.includes('ERR_ABORTED')) {
        log('noise', `the reload aborted this request, as a reload does — not counted: ${line}`);
        return;
      }
      noise.failedRequests.push(line);
      saw(page, 'failed request', line);
    });
    page.on('response', (response) => {
      answered += 1;
      if (response.status() < 400 || !isTheApps(response.url())) return;
      const line = `${tag}${response.status()} ${response.request().method()} ${response.url()}`;
      noise.badAnswers.push(line);
      saw(page, `answer ${response.status()}`, line);
    });
  };

  return { noise, count, stopped, listen, answers: () => answered };
}
