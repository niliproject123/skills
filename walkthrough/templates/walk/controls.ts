// The harness half of the walk's controls: how a control is touched (ring, gate, act), the wait for
// "Next", and "Back" / "Return here" — navigation only, never a write.
//
// Touching a control (`act`), every time, in this order:
//   1. wait until it is visible (a ceiling, by name);
//   2. remember where it stands (page address, the sections around it, whether it is inside something an
//      earlier press opened, whose screen it is) — the places "Back" goes to;
//   3. scroll the section that holds it into view, then the control itself if it is still outside the
//      window — the watcher sees the context first, then the control;
//   4. draw the ring on it;
//   5. if this is the step's first control, wait for "Next" here (the gate) — so whatever the step did before
//      its first control (navigating to its screen, reading) happened while "Next" stood, and the ring shows
//      what is about to be touched before the person presses;
//   6. hold `ringHoldMs`, so the eye reaches the ring before the control changes;
//   7. check it is enabled (a disabled control is a named error, never a forced click), then act.
//
// "Back" goes one remembered place further back each press: the page (navigated only when the address
// differs), the sections unfolded, the ring drawn. A place on another person's screen is not crossed into —
// the walk would have to sign out — and the strip says so. A control inside something opened (a menu, a
// dialog, a side panel) cannot be reached by address and section: its page and innermost section are shown.
// "Return here" goes back where the walk stopped; standing before a step's first control, a control inside
// something opened is reached by running the step again from its start — safe, because the walk stops only
// before the step's first touch, so the step has written nothing yet (`STEP_AGAIN`, caught by the runner).
// A "Next" pressed while the screen stands elsewhere first returns here, then the walk goes on.
import type { Locator, Page } from 'playwright';
import { say, type Dictionary } from './dictionary';
import type { GuideApi } from './overlay';
import { firstLineOf, WalkError, type Act, type AppHooks, type WalkConfig } from './types';

export const STEP_AGAIN = 'walk.step_again';
export const isStepAgain = (thrown: unknown): boolean => thrown instanceof WalkError && thrown.code === STEP_AGAIN;

/** Call a method of the overlay on the page. Arguments must be JSON values; a missing overlay is an error. */
export async function guideCall<M extends keyof GuideApi>(page: Page, method: M, ...args: Parameters<GuideApi[M]>): Promise<ReturnType<GuideApi[M]>> {
  const answer = await page.evaluate(([name, given]) => {
    const guide = (window as unknown as { __walkGuide?: Record<string, (...values: unknown[]) => unknown> }).__walkGuide;
    if (!guide) throw new Error('the walk overlay is not on this page — walkOverlayScript was not added to its context');
    const call = guide[name];
    if (typeof call !== 'function') throw new Error('the walk overlay has no method ' + name);
    return call.apply(guide, given);
  }, [method, args as unknown[]] as const);
  return answer as ReturnType<GuideApi[M]>;
}

interface Place {
  actor: string;
  url: string;
  /** The section keys around the control, outermost first. */
  sections: string[];
  /** Inside something an earlier press opened. */
  inside: boolean;
  label: string;
  control: Locator;
}

type Log = (actor: string, message: string) => void;

export class WalkControls {
  private readonly places: Place[] = [];
  private shownAt: number | null = null;
  private restoring = false;
  private gate: (() => Promise<void>) | null = null;
  /** Milliseconds spent waiting for a person since the last `takeWaited()` — taken out of a step's acting time. */
  private waited = 0;

  constructor(
    private readonly page: Page,
    private readonly config: WalkConfig,
    private readonly hooks: AppHooks,
    private readonly words: Dictionary,
    private readonly log: Log,
    private readonly holder: () => string,
    /** Resolves once the page has no request in flight — called before the walk navigates by itself. */
    private readonly quietBeforeLeaving: (what: string) => Promise<void>,
  ) {}

  /** The touches a step makes, logged under `actor`. */
  act(actor: () => string): Act {
    const touch = async (control: Locator, what: string, action: () => Promise<unknown>): Promise<void> => {
      await this.beforeTouching(control, what);
      if (!(await control.isEnabled())) throw new WalkError('control.not_enabled', `the control is not enabled: ${what}`);
      this.log(actor(), `touches: ${what}`);
      await action();
    };
    return {
      press: (control, what) => touch(control, what, () => control.click()),
      fill: (control, value, what) => touch(control, what, () => control.fill(value)),
      choose: (control, value, what) => touch(control, what, () => control.selectOption(value)),
      tick: (control, what) => touch(control, what, () => control.check()),
      untick: (control, what) => touch(control, what, () => control.uncheck()),
      upload: (control, files, what) => touch(control, what, () => control.setInputFiles(files)),
      point: async (control, what) => {
        await this.beforeTouching(control, what);
        this.log(actor(), `points at: ${what}`);
      },
    };
  }

  /** The next touch on this page waits on `untilAnswered` with its ring standing — one touch, then the gate is gone. */
  gateTheNextTouch(untilAnswered: () => Promise<void>): void {
    this.gate = untilAnswered;
  }

  /** True when no touch reached the gate (the step touched nothing, or threw before its first touch). */
  takeTheGateOff(): boolean {
    const standing = this.gate !== null;
    this.gate = null;
    return standing;
  }

  takeWaited(): number {
    const waited = this.waited;
    this.waited = 0;
    return waited;
  }

  private async beforeTouching(control: Locator, what: string): Promise<void> {
    await control.waitFor({ state: 'visible', timeout: 30_000 }).catch((thrown: unknown) => {
      throw new WalkError('control.not_visible', `the control did not become visible within 30 s: ${what} — ${firstLineOf(thrown)}`);
    });
    await this.remember(control, what);
    await this.drawTheRing(control);
    const gate = this.gate;
    if (gate) {
      this.gate = null;
      await gate(); // "Next", with the ring standing on the control it is about to touch
    }
    await this.page.waitForTimeout(this.config.ringHoldMs); // pacing for the watcher's eye, not a wait on the app
  }

  /** The section around the control into view, then the control if still outside the window, then the ring. */
  async drawTheRing(control: Locator): Promise<void> {
    await control.evaluate((element, [attribute, opened]) => {
      // No named function in here: tsx would wrap it in __name, which the page does not have.
      const guide = (window as unknown as { __walkGuide?: { follow(element: Element): void } }).__walkGuide;
      if (!guide) throw new Error('the walk overlay is not on this page — the ring has nowhere to be drawn');
      const container = element.closest(opened);
      let section = element.closest('[' + attribute + ']');
      if (container && section && !container.contains(section)) section = null;
      if (section && section.getBoundingClientRect().height <= window.innerHeight) {
        section.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      }
      const box = element.getBoundingClientRect();
      if (box.top < 0 || box.bottom > window.innerHeight || box.left < 0 || box.right > window.innerWidth) {
        element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      }
      guide.follow(element);
    }, [this.config.sectionAttribute, this.config.openedByPressSelector] as const);
  }

  private async remember(control: Locator, what: string): Promise<void> {
    if (this.restoring) return;
    const read = await control.evaluate((element, [attribute, opened]) => {
      const container = element.closest(opened);
      const sections: string[] = [];
      for (let node = element.closest('[' + attribute + ']'); node; node = node.parentElement ? node.parentElement.closest('[' + attribute + ']') : null) {
        if (!container || node.contains(container)) sections.unshift(node.getAttribute(attribute) ?? '');
      }
      return { url: location.href, sections, inside: container !== null };
    }, [this.config.sectionAttribute, this.config.openedByPressSelector] as const);
    this.places.push({ ...read, label: what, actor: this.holder(), control });
    this.shownAt = null;
  }

  /**
   * "Next" asked under `id`, waited for with no ceiling — a person takes the time they take. "Back" and
   * "Return here" pressed meanwhile are served in between. `gated`: the walk stands before a step's first
   * control with its ring on it, so "Return here" into something opened runs the step again.
   */
  async untilAnswered(id: string, what: string, gated: boolean): Promise<void> {
    const started = Date.now();
    const stoppedUrl = this.page.url();
    try {
      for (;;) {
        const handle = await this.page.waitForFunction((questionId) => {
          const guide = (window as unknown as { __walkGuide?: { answered(): string; pendingRequest(): unknown } }).__walkGuide;
          if (!guide) return false;
          if (guide.answered() === questionId) return { seq: 0, kind: 'answered' };
          return guide.pendingRequest() ?? false;
        }, id, { timeout: 0, polling: 250 });
        const got = (await handle.jsonValue()) as { seq: number; kind: 'answered' | 'back' | 'here' };
        await handle.dispose();
        if (got.kind === 'answered') {
          if (this.shownAt === null && this.page.url() === stoppedUrl) return;
          this.log('walk', `Next pressed while the screen stood elsewhere — back where the walk stopped first · ${what}`);
          await this.returnHere(gated, stoppedUrl, true);
          await guideCall(this.page, 'place', '', false);
          return;
        }
        await guideCall(this.page, 'takeRequest', got.seq);
        if (got.kind === 'back') await this.stepBack();
        else await this.returnHere(gated, stoppedUrl, false);
      }
    } finally {
      this.waited += Date.now() - started;
    }
  }

  private async stepBack(): Promise<void> {
    const to = (this.shownAt ?? this.places.length - 1) - 1;
    const place = this.places[to];
    if (!place) {
      await guideCall(this.page, 'place', say(this.words, 'noEarlierPlace'), true);
      return;
    }
    if (place.actor !== this.holder()) {
      await guideCall(this.page, 'place', say(this.words, 'otherPersonsPlace'), true);
      return;
    }
    this.log('walk', `Back — to ${place.label} · ${place.url} · ${place.sections.join(' › ') || 'no section'}${place.inside ? ' · inside something opened' : ''}`);
    this.shownAt = to;
    await this.goTo(place, say(this.words, 'backAt', { label: place.label }), false);
  }

  /** Back where the walk stopped. `mustArrive`: "Next" is about to act there, so failing to arrive ends the step. */
  private async returnHere(gated: boolean, stoppedUrl: string, mustArrive: boolean): Promise<void> {
    const here = this.places[this.places.length - 1];
    this.shownAt = null;
    if (gated && here && here.inside) {
      this.log('walk', `Return here — ${here.label} is inside something opened: the step runs again from its start`);
      await guideCall(this.page, 'place', say(this.words, 'stepAgain', { label: here.label }), false);
      throw new WalkError(STEP_AGAIN, `Return here on ${here.label}, inside something an earlier press opened — the step runs again from its start`);
    }
    if (here && here.url === stoppedUrl && !here.inside) {
      await this.goTo(here, say(this.words, 'hereAt', { label: here.label }), mustArrive);
      return;
    }
    this.log('walk', `Return here — the page the walk stopped on, ${stoppedUrl}`);
    await this.goTo({ actor: this.holder(), url: stoppedUrl, sections: [], inside: false, label: '', control: this.page.locator('body') }, say(this.words, 'herePage'), mustArrive);
  }

  private async goTo(place: Place, line: string, mustArrive: boolean): Promise<void> {
    this.restoring = true;
    try {
      if (this.page.url() !== place.url) {
        await this.quietBeforeLeaving(`the walk leaves ${this.page.url()} for ${place.url}`);
        await this.page.goto(place.url, { waitUntil: 'domcontentloaded' });
      }
      for (const key of place.sections) {
        if (this.hooks.unfoldSection) await this.hooks.unfoldSection(this.page, key);
      }
      const innermost = place.sections[place.sections.length - 1];
      const target = !place.inside ? place.control
        : innermost !== undefined ? this.page.locator(`[${this.config.sectionAttribute}="${innermost.replace(/"/g, '\\"')}"]`).first() : null;
      if (target) {
        await target.waitFor({ state: 'visible', timeout: 15_000 });
        await this.drawTheRing(target);
      } else {
        await guideCall(this.page, 'unfollow');
      }
      await guideCall(this.page, 'place', line + (place.inside ? say(this.words, 'insideOpened') : ''), false);
    } catch (thrown) {
      this.log('walk', `could not reach ${place.label || place.url} — ${firstLineOf(thrown)}`);
      if (mustArrive) throw thrown;
      await guideCall(this.page, 'place', say(this.words, 'couldNotReach', { label: place.label || place.url, message: firstLineOf(thrown) }), true);
    } finally {
      this.restoring = false;
    }
  }
}
