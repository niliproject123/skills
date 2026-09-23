// What is over a control before it is clicked — the app's own overlays, not the video's.
//
// A toast, a cookie banner, an upload tray can sit over a control, and Playwright then reports
// "element intercepts pointer events", which names the banner nowhere. Before every press the
// runtime puts away the overlays the settings call dismissible, logs each one, and names whatever
// still covers the control. The video's own overlay is never found here: it has pointer-events none.
import type { Locator, Page } from 'playwright';
import { firstLineOf, VideoError } from '../errors';

export interface DismissibleOverlay {
  /** What it is, in the log — a person's words: `the cookie banner`. */
  what: string;
  selector: string;
  /** The control inside it that puts it away. */
  dismiss: string;
}

type Log = (actor: string, message: string) => void;

async function boxesOverlap(one: Locator, two: Locator): Promise<boolean> {
  const [a, b] = await Promise.all([one.boundingBox(), two.boundingBox()]);
  if (!a || !b) return false;
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Put away every dismissible overlay lying over `target`; each dismissal is logged by name. */
export async function dismissOverlays(page: Page, target: Locator, overlays: readonly DismissibleOverlay[], log: Log): Promise<void> {
  for (const overlay of overlays) {
    const node = page.locator(overlay.selector).first();
    if ((await node.count()) === 0 || !(await node.isVisible())) continue;
    if (!(await boxesOverlap(node, target))) continue;
    const control = page.locator(overlay.dismiss).first();
    if ((await control.count()) === 0) {
      log('overlay', `${overlay.what} is over the control and its dismiss control (${overlay.dismiss}) is not there`);
      continue;
    }
    await control.click();
    try {
      await node.waitFor({ state: 'hidden', timeout: 5_000 });
    } catch (thrown) {
      throw new VideoError('overlay.would_not_dismiss', `${overlay.what} did not go away when ${overlay.dismiss} was pressed — the click under it would be blind (${firstLineOf(thrown)})`);
    }
    log('overlay', `dismissed ${overlay.what} — it was over the control`);
  }
}

/** What is at the control's click point when it is not the control; null when it is clear. */
export async function whatCovers(page: Page, target: Locator): Promise<string | null> {
  const box = await target.boundingBox();
  if (!box) return 'the control has no box — it is not laid out';
  const handle = await target.elementHandle({ timeout: 5_000 });
  if (!handle) return 'the control has no element handle';
  try {
    return await page.evaluate(
      ({ point, wanted }) => {
        const stack = document.elementsFromPoint(point.x, point.y);
        const top = stack[0];
        if (!top) return 'the click point is outside the viewport';
        if (top === wanted || top.contains(wanted) || wanted.contains(top)) return null;
        return stack
          .slice(0, 3)
          .map((node) => '<' + node.tagName.toLowerCase() + (node.id ? ' id="' + node.id + '"' : '') + (node.getAttribute('class') ? ' class="' + node.getAttribute('class') + '"' : '') + '>')
          .join(' over ');
      },
      { point: { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) }, wanted: handle },
    );
  } finally {
    await handle.dispose();
  }
}
