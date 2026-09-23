// How a scenario touches a control — the one place it happens, so the rules hold everywhere and the
// video hooks in once: every press is checked visible **and** enabled first, the app's dismissible
// overlays are put away and named, and then the recorder draws its pointer and caption.
//
// A target is found by, in order of preference:
//   'save-button'                  a test id — needs `locators.testIdAttribute` in the settings
//   { role: 'button', name: 'Save' }   the accessible role and name
//   { label: 'Email' }             a form field by its label
//   { text: 'Invitation sent' }    visible text
//   a Playwright Locator           anything else, built by the scenario itself
// Role, label and text break when the wording changes; the runtime warns once per run when a
// project has no test id attribute, so the choice is visible.
import type { Locator, Page } from 'playwright';
import { VideoError } from '../errors';
import { guideBeforeFill, guideBeforePress } from '../recorder';
import { dismissOverlays, whatCovers, type DismissibleOverlay } from './overlays';

type Role = Parameters<Page['getByRole']>[0];
export type Target = string | { role: Role; name: string | RegExp } | { label: string | RegExp } | { text: string | RegExp } | Locator;

type Log = (actor: string, message: string) => void;

export interface Controls {
  locate: (target: Target) => Locator;
  press: (target: Target, what?: string) => Promise<void>;
  fill: (target: Target, value: string, what?: string) => Promise<void>;
  choose: (target: Target, value: string, what?: string) => Promise<void>;
  waitFor: (target: Target, state?: 'visible' | 'hidden', timeoutMs?: number) => Promise<void>;
}

const isLocator = (target: Target): target is Locator => typeof target === 'object' && target !== null && 'click' in target;

/** How the target reads in a log line and, when it has no words of its own, in a caption. */
export function describeTarget(target: Target): string {
  if (typeof target === 'string') return target;
  if (isLocator(target)) return String(target);
  if ('role' in target) return String(target.name);
  if ('label' in target) return String(target.label);
  return String(target.text);
}

export function controlsFor(page: Page, testIdAttribute: string | null, overlays: readonly DismissibleOverlay[], log: Log): Controls {
  const locate = (target: Target): Locator => {
    if (typeof target === 'string') {
      if (!testIdAttribute) {
        throw new VideoError('locators.no_test_id', `"${target}" is a test id, and the settings name no locators.testIdAttribute — use { role, name }, { label } or { text } instead`);
      }
      return page.getByTestId(target);
    }
    if (isLocator(target)) return target;
    if ('role' in target) return page.getByRole(target.role, { name: target.name });
    if ('label' in target) return page.getByLabel(target.label);
    return page.getByText(target.text);
  };

  const ready = async (locator: Locator, what: string): Promise<void> => {
    await locator.waitFor({ state: 'visible', timeout: 10_000 });
    if (!(await locator.isEnabled())) throw new VideoError('control.not_enabled', `the control is not enabled: ${what}`);
    await locator.scrollIntoViewIfNeeded();
  };

  const press = async (target: Target, what?: string): Promise<void> => {
    const locator = locate(target).first();
    const name = what ?? describeTarget(target);
    await ready(locator, name);
    await dismissOverlays(page, locator, overlays, log);
    const covering = await whatCovers(page, locator);
    if (covering) log('overlay', `${name} is under ${covering} — no dismissible overlay matches it; the click goes ahead and Playwright decides`);
    // After the overlays are gone, before the click: the pointer lands where the click will.
    await guideBeforePress(page, locator, typeof target === 'string' && !what ? `[${testIdAttribute}="${target}"]` : name);
    await locator.click();
  };

  const fill = async (target: Target, value: string, what?: string): Promise<void> => {
    const locator = locate(target).first();
    const name = what ?? describeTarget(target);
    await ready(locator, name);
    await guideBeforeFill(page, locator, name);
    await locator.fill(value);
  };

  const choose = async (target: Target, value: string, what?: string): Promise<void> => {
    const locator = locate(target).first();
    const name = what ?? describeTarget(target);
    await ready(locator, name);
    await guideBeforeFill(page, locator, name);
    await locator.selectOption(value);
  };

  const waitFor = async (target: Target, state: 'visible' | 'hidden' = 'visible', timeoutMs = 15_000): Promise<void> => {
    await locate(target).first().waitFor({ state, timeout: timeoutMs });
  };

  return { locate, press, fill, choose, waitFor };
}
