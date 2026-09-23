// How a person gets signed in, by the method the settings name:
//   none   — nothing; the page opens as it is.
//   token  — the sign-in call is made from here, and the token written into the page's storage (or
//            a cookie) before any app script runs, so the app boots signed in. Nothing is filmed.
//   form   — the sign-in page is filled and submitted in the browser, then the runtime waits for
//            `signedInWhen`. It happens before the page is named, so it is never in a video.
import type { BrowserContext, Page } from 'playwright';
import type { Person, TokenSignIn, VideoSettings } from '../config';
import { VideoError } from '../errors';

function passwordOf(person: Person): string {
  const variable = person.passwordVariable;
  if (!variable) throw new VideoError('sign_in.no_password_variable', `${person.name} has no passwordVariable in the settings`);
  const value = process.env[variable];
  if (!value) throw new VideoError('sign_in.password_missing', `${person.name}'s password is read from ${variable}, which is not set`);
  return value;
}

function valueAt(answer: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => (value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), answer);
}

async function fetchToken(method: TokenSignIn, person: Person, appAddress: string): Promise<string> {
  const password = passwordOf(person);
  const body: Record<string, string> = {};
  for (const [key, value] of Object.entries(method.request.body)) {
    body[key] = value.replace('{username}', person.username ?? '').replace('{password}', password);
  }
  const address = new URL(method.request.address, `${appAddress}/`).href;
  const answer = await fetch(address, { method: method.request.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await answer.text();
  if (!answer.ok) throw new VideoError('sign_in.refused', `signing in ${person.name} at ${address} answered ${answer.status}: ${text.slice(0, 300)}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new VideoError('sign_in.not_json', `signing in ${person.name} at ${address} answered 2xx with a body that is not JSON: ${text.slice(0, 300)}`);
  }
  const token = valueAt(parsed, method.tokenAt);
  if (typeof token !== 'string' || token === '') throw new VideoError('sign_in.no_token', `signing in ${person.name} answered 2xx with no token at "${method.tokenAt}": ${text.slice(0, 300)}`);
  return token;
}

/** Before the page opens: for `token`, the token goes in ahead of every app script. */
export async function prepareSignIn(context: BrowserContext, settings: VideoSettings, person: Person, appAddress: string): Promise<void> {
  const method = settings.signIn;
  if (method.method !== 'token') return;
  const token = await fetchToken(method, person, appAddress);
  if (method.keep.where === 'cookie') {
    await context.addCookies([{ name: method.keep.name, value: token, url: appAddress }]);
    return;
  }
  await context.addInitScript(
    ([where, name, value]) => {
      // Only the app's own http(s) documents; a sandboxed frame has no storage, and throwing there
      // would be a page error that is the frame's, not the app's.
      if (!window.location.protocol.startsWith('http')) return;
      (where === 'localStorage' ? window.localStorage : window.sessionStorage).setItem(name as string, value as string);
    },
    [method.keep.where, method.keep.name, token] as const,
  );
}

/** After the page opens: for `form`, the sign-in page is filled and the signed-in mark awaited. */
export async function completeSignIn(page: Page, settings: VideoSettings, person: Person, appAddress: string): Promise<void> {
  const method = settings.signIn;
  if (method.method !== 'form') return;
  await page.goto(new URL(method.page, `${appAddress}/`).href);
  await page.locator(method.usernameField).fill(person.username ?? '');
  await page.locator(method.passwordField).fill(passwordOf(person));
  await page.locator(method.submit).click();
  try {
    await page.locator(method.signedInWhen).first().waitFor({ state: 'visible', timeout: 20_000 });
  } catch {
    throw new VideoError('sign_in.not_signed_in', `${person.name} submitted the sign-in form and "${method.signedInWhen}" never appeared within 20s — wrong password, or the mark is wrong`);
  }
}
