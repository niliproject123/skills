/**
 * self-check — the video tools, proven on this machine without an app.   `npm run self-check`
 *
 * Two people on two pages (HTML answered inside the browser by `page.route` at a made-up address —
 * no server), a chapter with a long Hebrew heading, presses and a fill, then the cut and the
 * subtitles. Right to left throughout, because that is the harder case.
 *
 * It checks the overlay's promises to the scenario (not what `elementFromPoint` finds, no attribute
 * added, no text in the page), the title card (fades in, holds three seconds, fades out; a long
 * heading wraps and fits; an oversized one is stepped down), the strip (side note as one phrase,
 * nothing cut), the pointer on the pressed control on the right-hand side of an RTL page, masking
 * (email and phone painted over, the page's text unchanged), the cut (a left-out press is cut, a
 * fill after it is cut too), the .srt, the one-phrase guard, and a left-to-right card.
 *
 * Env: `SHOW_BROWSER=yes` to watch it; `VIDEO_RECORDING_FOLDER` (default `<os temp>/scenario-video-self-check`,
 * emptied first). Mocked: the two pages are HTML written in this file and the plan is written here;
 * the recorder, overlay, cutter, ffmpeg and Chromium are the real ones.
 * Exit code: 0 when every check held.
 */
import { chromium, type Page } from 'playwright';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildGuideVideos, RUN_RESULT_FILE, type RunResult } from './build';
import { BUILT_IN_WORDS, captionLooksRaw } from './captions';
import { DEFAULT_COLOURS, DEFAULT_FONT, OVERLAY_GLOBAL, STORAGE_PREFIX, type Look } from './overlay';
import { writeRecordingPlan, writtenPattern, type GuidePlan, type RecordingPlan } from './plan';
import * as recorder from './recorder';

process.env[recorder.RECORDING_FOLDER_VARIABLE] ??= join(tmpdir(), 'scenario-video-self-check');
const folder = resolve(process.env[recorder.RECORDING_FOLDER_VARIABLE] as string);
const failures: string[] = [];
const started = Date.now();
const say = (actor: string, message: string): void => console.log(`[+${((Date.now() - started) / 1000).toFixed(3)}s] [${actor}] ${message}`);
function check(what: string, held: boolean, detail = ''): void {
  if (held) say('check', `PASS ${what}`);
  else {
    failures.push(what);
    say('check', `ASSERT FAILED: ${what}${detail ? ` (${detail})` : ''}`);
  }
}

/** A long, generic Hebrew heading — a full sentence, as a real step title sometimes is. */
const LONG_HEADING = 'שלב שלישי: הגשת הבקשה לבדיקה ראשונית של הצוות המקצועי לקראת אישור הפרויקט והעברתו לשלב הבא';
const PEOPLE = ['דנה', 'עומר'] as const;
const words = BUILT_IN_WORDS['he'];
if (!words) throw new Error('the built-in Hebrew words are missing');
const rtlLook: Look = {
  direction: 'rtl', font: DEFAULT_FONT, colours: DEFAULT_COLOURS, logo: null, peopleLabel: words.people,
  masking: { fields: [], patterns: ['email', 'phone'] },
};
const recordingPlan: RecordingPlan = {
  planName: 'self-check',
  language: 'he',
  words,
  look: rtlLook,
  chapters: [{
    step: writtenPattern(/^שלב שלישי:/),
    people: ['דנה — מגישת הבקשה', 'עומר — בודק'],
    sideNotes: ['סטטוס: הוגש לבדיקה'],
    slideNotes: ['אין מעבר אוטומטי — אדם לוחץ'],
  }],
  captionRules: [],
};

const ADDRESS = 'http://scenario-video-self-check.invalid/';
// dir="rtl": the first button sits at the right-hand edge, where a right-to-left reader starts.
const PAGE_HTML = `<!doctype html><html dir="rtl" lang="he"><body style="font-family:Arial;padding:40px">
  <h1>מסך בדיקה</h1>
  <button data-testid="first" style="font-size:20px">כפתור ראשון</button>
  <button data-testid="second" style="font-size:20px;margin-inline-start:40px">כפתור שני</button>
  <p>כתובת: dana@example.com · טלפון: 050-123-4567</p>
  <label style="display:block;margin-top:30px">שם מלא <input style="font-size:20px"></label>
  <div style="height:400px"></div>
  <button data-testid="bottom" style="position:fixed;bottom:30px;left:50%">כפתור תחתון</button>
</body></html>`;

interface Probe {
  cardOpacity: number; cardTransition: string; cardDirection: string; stripDirection: string;
  titleFontSizePx: number; titleLines: number; cardFitsTheFrame: boolean; cardHeldMs: number; cardText: string;
  stripSidesHtml: string; stripLinesCut: number; pointerX: number; pointerY: number; maskedRanges: number;
}
async function probe(page: Page): Promise<Probe> {
  return page.evaluate((name) => {
    const api = (window as unknown as Record<string, { probe(): Probe } | undefined>)[name];
    if (!api) throw new Error('the overlay is not on this page');
    return api.probe();
  }, OVERLAY_GLOBAL);
}
interface RingBox { hidden: boolean; x: number; y: number; width: number; height: number; following: boolean }
async function ringOf(page: Page): Promise<RingBox | null> {
  return page.evaluate((name) => {
    const api = (window as unknown as Record<string, { ringBox(): RingBox | null } | undefined>)[name];
    if (!api) throw new Error('the overlay is not on this page');
    return api.ringBox();
  }, OVERLAY_GLOBAL);
}
async function raiseCard(page: Page, slide: unknown, on: boolean): Promise<void> {
  await page.evaluate(([name, it, raise]) => {
    const api = (window as unknown as Record<string, { card(slide: unknown, on: boolean): void } | undefined>)[name as string];
    if (!api) throw new Error('the overlay is not on this page');
    api.card(it, raise as boolean);
  }, [OVERLAY_GLOBAL, slide, on] as const);
}
async function attributes(page: Page): Promise<string> {
  return page.evaluate(() => Array.from(document.querySelectorAll('*')).flatMap((el) => Array.from(el.attributes).map((a) => `${el.tagName}.${a.name}=${a.value}`)).sort().join('\n'));
}

async function main(): Promise<void> {
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  writeRecordingPlan(folder, recordingPlan);
  recorder.useRecordingPlan(recordingPlan);
  check('a Hebrew caption with a test id in it reads as raw', captionLooksRaw('לוחצים על ״save-button״', 'he'));
  check('a Hebrew caption in Hebrew reads as finished', !captionLooksRaw('לוחצים על ״שמירה״', 'he'));
  check('an English caption with an identifier reads as raw', captionLooksRaw('Click “saveButton”', 'en'));
  check('an English caption in words reads as finished', !captionLooksRaw('Click “Save”', 'en'));

  const browser = await chromium.launch({ headless: process.env['SHOW_BROWSER'] !== 'yes' });
  const viewport = { width: 1280, height: 800 };
  const pages: Page[] = [];
  for (const who of PEOPLE) {
    const context = await browser.newContext({ viewport, locale: 'he-IL', ...recorder.guideContextOptions(viewport) });
    await recorder.prepareGuideContext(context);
    const page = await context.newPage();
    recorder.noteGuidePageOpened(page);
    // A made-up address answered in the browser: a real origin (storage and reload work), nothing listening.
    await page.route(`${ADDRESS}**`, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE_HTML }));
    await page.goto(ADDRESS);
    await recorder.nameGuidePage(page, who);
    pages.push(page);
  }
  const [dana, omer] = pages as [Page, Page];
  const textBefore = await dana.evaluate(() => document.body.innerText);
  const attributesBefore = await attributes(dana);

  recorder.guideStep(LONG_HEADING, 'בקשה חדשה · טיוטה ← הוגש');
  const first = dana.getByTestId('first');
  const whileTheCardStands = (async (): Promise<Probe> => {
    await dana.waitForTimeout(700); // past the .35s fade in, well inside the 3s hold
    return probe(dana);
  })();
  await recorder.guideBeforePress(dana, first, '[data-testid="first"]');
  const standing = await whileTheCardStands;
  const after = await probe(dana);
  const firstBox = await first.boundingBox();
  check('the title card is fully faded in while it stands', standing.cardOpacity === 1, `opacity ${standing.cardOpacity}`);
  check('the card fades by a transition, not a jump', /0\.35s/.test(standing.cardTransition), standing.cardTransition);
  check('the card is gone by the time the press happens', after.cardOpacity === 0, `opacity ${after.cardOpacity}`);
  check(`the card is held ${recorder.TITLE_CARD_MS}ms`, Math.abs(after.cardHeldMs - recorder.TITLE_CARD_MS) <= 250, `held ${after.cardHeldMs}ms`);
  check('the card and the strip are right to left', standing.cardDirection === 'rtl' && after.stripDirection === 'rtl', `${standing.cardDirection} · ${after.stripDirection}`);
  check('a long Hebrew heading stands inside the frame', standing.cardFitsTheFrame);
  check('a long Hebrew heading wraps onto several lines', standing.titleLines >= 2, `${standing.titleLines} line(s)`);
  check('a long Hebrew heading needs no stepping down', standing.titleFontSizePx === 54, `${standing.titleFontSizePx}px`);
  check('the card names the chapter\'s people', standing.cardText.includes('משתתפים: דנה — מגישת הבקשה · עומר — בודק'), standing.cardText);
  check('the card carries the side note and the card note', standing.cardText.includes('סטטוס: הוגש לבדיקה') && standing.cardText.includes('אין מעבר אוטומטי — אדם לוחץ'));
  check('the strip carries the side note as one line', after.stripSidesHtml === '<span>סטטוס: הוגש לבדיקה</span>', after.stripSidesHtml);
  check('no strip line was cut for length', after.stripLinesCut === 0, `${after.stripLinesCut} cut`);
  check(
    'the pointer rests on the pressed control at the right-hand side of the RTL page',
    firstBox !== null && firstBox.x > viewport.width / 2 && Math.abs(after.pointerX - (firstBox.x + firstBox.width / 2)) < 2 && Math.abs(after.pointerY - (firstBox.y + firstBox.height / 2)) < 2,
    firstBox ? `control at x=${firstBox.x.toFixed(0)}, pointer at ${after.pointerX},${after.pointerY}` : 'no box',
  );
  check('the email and the phone are painted over', after.maskedRanges >= 2, `${after.maskedRanges} masked`);
  check('the page text is unchanged — masking and captions paint, they do not write', (await dana.evaluate(() => document.body.innerText)) === textBefore);
  check('drawing the card, the strip and the pointer changes no attribute in the page', (await attributes(dana)) === attributesBefore);
  const bottom = dana.getByTestId('bottom');
  const box = await bottom.boundingBox();
  const under = box ? await dana.evaluate(([x, y]) => document.elementFromPoint(x as number, y as number)?.getAttribute('data-testid') ?? 'nothing', [box.x + box.width / 2, box.y + box.height / 2] as const) : 'no box';
  check('the strip is not what elementFromPoint finds over a control', under === 'bottom', `found ${under}`);
  await first.click();
  await recorder.guideBeforePress(dana, dana.getByTestId('second'), 'כפתור שני');
  await dana.getByTestId('second').click();
  const field = dana.getByLabel('שם מלא');
  await recorder.guideBeforeFill(dana, field, 'full-name');
  await field.fill('ישראל ישראלי');
  await dana.waitForTimeout(1_500); // the last action's result on screen, for the clip's tail

  // A panel that slides in (a CSS animation from the moment it is added, as a side panel does): the
  // ring follows it and lands where it stops, not where it was when it was pointed at; and it is
  // hidden the moment the panel leaves the page.
  await dana.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '@keyframes check-slide-in { from { transform: translateX(-420px); } to { transform: none; } }';
    document.head.appendChild(style);
    const panel = document.createElement('div');
    panel.setAttribute('data-testid', 'sliding');
    panel.textContent = 'פאנל שנפתח';
    panel.style.cssText = 'position:fixed;top:120px;left:60px;width:300px;height:200px;background:#eef;animation:check-slide-in .6s ease-out;';
    document.body.appendChild(panel);
  });
  const sliding = dana.getByTestId('sliding');
  await recorder.guideShowing(dana, sliding, 'the sliding panel', 'פאנל שנפתח', 1_000);
  const movingAtFirst = await ringOf(dana);
  await dana.waitForFunction(() => document.querySelector('[data-testid="sliding"]')?.getAnimations().length === 0, undefined, { timeout: 5_000 });
  await dana.waitForTimeout(100); // one more frame for the follower to settle
  const stopped = await ringOf(dana);
  const panelBox = await sliding.boundingBox();
  check('a moving element is followed while it moves', movingAtFirst?.following === true, JSON.stringify(movingAtFirst));
  check(
    'the ring lands where the sliding panel stops',
    panelBox !== null && stopped !== null && Math.abs(stopped.x - panelBox.x) < 2 && Math.abs(stopped.y - panelBox.y) < 2 && Math.abs(stopped.width - panelBox.width) < 2,
    `panel ${JSON.stringify(panelBox)} · ring ${JSON.stringify(stopped)}`,
  );
  check('the follower stops once the element is still', stopped?.following === false, JSON.stringify(stopped));
  await dana.evaluate(() => document.querySelector('[data-testid="sliding"]')?.remove());
  await dana.waitForTimeout(100); // the removal is seen by a mutation observer, on the next task
  const gone = await ringOf(dana);
  check('the ring is hidden when the element leaves the page', gone?.hidden === true, JSON.stringify(gone));

  recorder.guideStep('עומר בודק');
  await recorder.guideBeforePress(omer, omer.getByTestId('first'), 'כפתור ראשון');
  await omer.getByTestId('first').click();
  await omer.reload();
  check('the step title is drawn again after a reload', await omer.evaluate((key) => sessionStorage.getItem(key) === 'עומר בודק', `${STORAGE_PREFIX}step`));
  const undeclared = await probe(omer);
  check('a step with no chapter draws no side note', undeclared.stripSidesHtml === '', undeclared.stripSidesHtml);
  await recorder.guideBeforePress(omer, omer.getByTestId('second'), 'כפתור שני');
  await omer.getByTestId('second').click();
  await omer.waitForTimeout(1_000); // the last action's result on screen

  // Shrink-to-fit where it engages: a heading eight times the long one, raised long after Dana's last
  // recorded action, so it is inside no clip.
  await raiseCard(dana, { title: new Array(8).fill(LONG_HEADING).join(' '), subtitle: '', who: '', people: [], sideNotes: [], slideNotes: [] }, true);
  const oversized = await probe(dana);
  check('a heading too tall for the frame is stepped down from 54px', oversized.titleFontSizePx < 54, `${oversized.titleFontSizePx}px`);
  check('a heading too tall for the frame still stands inside it', oversized.cardFitsTheFrame);
  await raiseCard(dana, null, false);

  // Left to right: the same overlay with an English look, on a page nobody is named on (in no video).
  recorder.useRecordingPlan({ ...recordingPlan, language: 'en', look: { ...rtlLook, direction: 'ltr' } });
  const english = await browser.newContext({ viewport });
  await recorder.prepareGuideContext(english);
  const englishPage = await english.newPage();
  await englishPage.route(`${ADDRESS}**`, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="en"><body><p>English page</p></body></html>' }));
  await englishPage.goto(ADDRESS);
  await raiseCard(englishPage, { title: 'Step three: sending the request', subtitle: '', who: '', people: [], sideNotes: [], slideNotes: [] }, true);
  const ltr = await probe(englishPage);
  check('an English look draws the card left to right', ltr.cardDirection === 'ltr', ltr.cardDirection);
  recorder.useRecordingPlan(recordingPlan);

  await recorder.finishGuideRecording();
  await browser.close();

  const run: RunResult = {
    scenario: 'self-check', command: ['self-check'], exitCode: 0, runId: 'self-check', appAddress: ADDRESS, seedCommand: '',
    startedAt: new Date(started).toISOString(), endedAt: new Date().toISOString(), branch: 'n/a', commit: 'n/a', acceptedFailedRun: false,
  };
  writeFileSync(join(folder, RUN_RESULT_FILE), JSON.stringify(run, null, 2));
  const plan: GuidePlan = {
    name: 'self-check',
    run: { command: ['self-check'] },
    videos: [
      { file: '01_dana', who: 'דנה', title: 'בדיקה', leaveOut: [{ what: /^כפתור שני$/, why: 'cut on purpose by the self-check' }], keepAtMost: [] },
      { file: '02_omer', who: 'עומר', title: 'בדיקה', leaveOut: [], keepAtMost: [] },
    ],
  };
  const built = buildGuideVideos(plan, folder, 'self-check (in memory)');
  check('both videos were made', built.videos.length === 2 && built.notMade.length === 0, built.notMade.join(' · '));
  for (const video of built.videos) check(`${video} is a real file`, existsSync(video) && statSync(video).size > 10_000, existsSync(video) ? `${statSync(video).size} bytes` : 'missing');
  const subtitles = built.subtitles[0] ? readFileSync(built.subtitles[0], 'utf8') : '';
  check('the subtitles carry the Hebrew caption, embedded right to left', subtitles.includes('‫לוחצים על ״כפתור ראשון״‬'), subtitles.slice(0, 300));
  check('the subtitles start with the title card at the start of the video', /^1\n00:00:00,[0-9]{3} --> /.test(subtitles), subtitles.slice(0, 80));
  check('the subtitles leave out the cut press', !subtitles.includes('כפתור שני'));
  const videoLog = readFileSync(built.logFile, 'utf8');
  check('the cut press is logged as cut', videoLog.includes('no — cut on purpose by the self-check'));
  check('a fill after a cut press is cut with it', /follows a cut press \(כפתור שני\)/.test(videoLog));
  check('the fill caption is the field\'s Hebrew label', videoLog.includes('ממלאים את ״שם מלא״'));
  check('no recording problem was logged', videoLog.includes('## Problems while recording (0)'), videoLog.split('## Problems')[1]?.slice(0, 400) ?? '');
  check('the video log carries the chapter', /\| שלב שלישי:.*\| סטטוס: הוגש לבדיקה \| אין מעבר אוטומטי/.test(videoLog));

  // The one-phrase guard, after the log was written so it does not disturb the count above.
  say('self-check', 'the next ERROR is provoked on purpose: a side note too long for the strip — the check after it proves it is reported');
  recorder.useRecordingPlan({ ...recordingPlan, chapters: [{ step: writtenPattern(/^בדיקת אורך$/), people: [], sideNotes: ['הערת צד ארוכה מדי שאינה נקראת במבט אחד על הרצועה'], slideNotes: [] }] });
  recorder.guideStep('בדיקת אורך');
  const noted = readFileSync(join(folder, recorder.PROBLEMS_FILE), 'utf8');
  check('a side note longer than one phrase is written down', noted.includes('the strip holds one phrase'), noted);
  say('self-check', `video log → ${built.logFile}`);
  say('self-check', failures.length ? `${failures.length} check(s) failed: ${failures.join(' · ')}` : 'every check held');
  process.exit(failures.length ? 1 : 0);
}

main().catch((thrown: unknown) => {
  console.error('FATAL', thrown);
  process.exit(1);
});
