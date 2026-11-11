# -*- coding: utf-8 -*-
"""Browser test of the full-screen view and the drawings, on a real deck.

    python tests/drawings_test.py <deck-folder> [--shots DIR] [--report FILE] [--compare-with REV]

<deck-folder> is a deck built with the skill (the example in
discussions/11.26-deck-drawings/example-deck has a picture on slides 02-04, with drawings
written by deck_draw.py on 03 and 04). It is copied to a temp folder first; the original
is never written. --compare-with REV also saves the copy with edit.js as it was at REV
and requires the two saved files to be byte-identical (the refactor check).

What is mocked: nothing. Real deck, real serve.py, real edit.js / lightbox.js / draw.js in
headless Chromium, real deck_draw.py. Confirm dialogs are accepted by the test, as a
reader clicking OK would.
"""
import argparse
import os
import shutil
import subprocess
import sys
import re
import tempfile

from deck_harness import SCRIPTS, DeckCopy, Results, watch_errors
import deck_draw
from playwright.sync_api import sync_playwright

LEAKS = ['lightbox', 'data-chrome', 'dw-sel', 'data-a=', 'data-b=', 'lb-frame', 'contenteditable']


def frame_box(page):
    return page.locator('#lightbox .lb-frame').bounding_box()


def drag(page, fx0, fy0, fx1, fy1):
    b = frame_box(page)
    page.mouse.move(b['x'] + b['width'] * fx0, b['y'] + b['height'] * fy0)
    page.mouse.down()
    page.mouse.move(b['x'] + b['width'] * fx1, b['y'] + b['height'] * fy1, steps=8)
    page.mouse.up()


def save(page):
    page.keyboard.press('Control+s')
    page.wait_for_function("document.getElementById('status').textContent.indexOf('נשמר') === 0",
                           timeout=8000)


def shot(page, shots, name):
    if not shots:
        return
    n = len([d for d in os.listdir(shots) if os.path.isdir(os.path.join(shots, d))]) + 1
    sub = os.path.join(shots, '%02d_%s' % (n, name))
    os.makedirs(sub, exist_ok=True)
    page.screenshot(path=os.path.join(sub, '%02d_%s.png' % (n, name)))


# where each drawing sits, as a share of its picture -- must not move when the window does
PLACES_JS = """() => [...document.querySelectorAll('.slide svg.drawings g.dw')].map(g => {
  const img = g.closest('.drawn-on').querySelector('img').getBoundingClientRect();
  const r = (g.querySelector('rect') || g.querySelector('line')).getBoundingClientRect();
  return [(r.left - img.left) / img.width, (r.top - img.top) / img.height,
          r.width / img.width, r.height / img.height];
})"""


def run(src, shots, res, errors):
    deck = DeckCopy(src)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width': 1500, 'height': 950})
            watch_errors(page, errors)
            page.on('dialog', lambda d: d.accept())
            page.goto(deck.base + 'deck.html', wait_until='networkidle')
            page.wait_for_function('window.deckDraw && window.deckLightbox')
            res.check('tools load (edit.js loads edit_changes.js, lightbox.js, draw.js)', True)
            res.check('clear-all button shows the 3 drawings from deck_draw.py',
                      page.locator('#btn-draw-clr').inner_text().strip().endswith('3'),
                      page.locator('#btn-draw-clr').inner_text())

            # ---- full screen: open, size, three ways to close ----
            img2 = page.locator('section[data-no="02"] img')
            img2.click()
            lb = page.locator('#lightbox')
            res.check('click on a picture opens full screen', lb.is_visible())
            b = frame_box(page)
            ratio_slide = img2.bounding_box()['width'] / img2.bounding_box()['height']
            res.check('full screen is bigger than the slide picture and keeps its shape',
                      b['width'] > img2.bounding_box()['width'] * 1.2
                      and abs(b['width'] / b['height'] - ratio_slide) < 0.02,
                      '%.0fx%.0f vs %.0f wide on the slide' % (b['width'], b['height'], img2.bounding_box()['width']))
            shot(page, shots, 'fullscreen-open')
            page.keyboard.press('Escape')
            res.check('Esc closes full screen', not lb.is_visible())
            img2.click()
            page.locator('#lightbox .lb-x').click()
            res.check('the x button closes full screen', not lb.is_visible())
            img2.click()
            page.mouse.click(8, 400)
            res.check('a click on the dark area closes full screen', not lb.is_visible())

            # ---- draw a box and an arrow on slide 02 ----
            img2.click()
            page.locator('#lightbox .t-kind[data-kind="box"]').click()
            drag(page, 0.20, 0.30, 0.50, 0.55)
            label = page.locator('#lightbox .lb-label')
            res.check('after a drag the label box opens', label.is_visible())
            label.fill('בדיקה & <תג>')
            label.press('Enter')
            page.locator('#lightbox .t-kind[data-kind="arrow"]').click()   # box -> arrow
            drag(page, 0.80, 0.80, 0.60, 0.60)
            page.locator('#lightbox .lb-label').fill('חץ')
            page.locator('#lightbox .lb-label').press('Enter')
            drag(page, 0.10, 0.10, 0.105, 0.105)
            res.check('a click without a drag draws nothing', page.locator('#lightbox .lb-label').count() == 0)
            shot(page, shots, 'fullscreen-drawn')
            page.keyboard.press('Escape')
            on_slide = page.evaluate("""() => {
              const s = document.querySelector('section[data-no="02"] svg.drawings');
              if (!s) return null;
              const r = s.querySelector('g[data-kind=box] rect');
              return {n: s.querySelectorAll('g.dw').length, vb: s.getAttribute('viewBox'),
                      x: +r.getAttribute('x'), w: +r.getAttribute('width'),
                      labels: [...s.querySelectorAll('text')].map(t => t.textContent)};
            }""")
            res.check('the drawings reach the slide', on_slide and on_slide['n'] == 2, str(on_slide))
            res.check('the box sits where it was drawn (20%..50% across)',
                      on_slide and abs(on_slide['x'] - 200) < 12 and abs(on_slide['w'] - 300) < 12,
                      on_slide and 'x=%s w=%s' % (on_slide['x'], on_slide['w']))
            res.check('labels kept as typed, & and < included',
                      on_slide and on_slide['labels'] == ['בדיקה & <תג>', 'חץ'], on_slide and str(on_slide['labels']))
            shot(page, shots, 'slide-drawn')

            # ---- save, reload, nothing of the editor left in the file ----
            save(page)
            text = deck.text()
            res.check('saved: the file has the drawings', text.count('<g class="dw"') == 5,
                      '%d drawings in the file' % text.count('<g class="dw"'))
            leaked = [k for k in LEAKS if k in text]
            res.check('saved: no editor chrome in the file', not leaked, ', '.join(leaked))
            res.check('saved: the slide list keeps no "here" mark (nav.js runtime state)',
                      not re.search(r'<a href="#s\d+" class="here"', text))
            page.reload(wait_until='networkidle')
            page.wait_for_function('window.deckDraw')
            res.check('after reload the drawings are still there',
                      page.locator('.slide svg.drawings g.dw').count() == 5)

            # ---- the drawings stay on their picture at any window size ----
            before = page.evaluate(PLACES_JS)
            worst = 0
            for w, h in ((900, 700), (1900, 1050)):
                page.set_viewport_size({'width': w, 'height': h})
                page.wait_for_timeout(250)
                after = page.evaluate(PLACES_JS)
                worst = max([worst] + [abs(a - b) for pa, pb in zip(before, after) for a, b in zip(pa, pb)])
            page.set_viewport_size({'width': 1500, 'height': 950})
            res.check('drawings stay on their picture at 900px and 1900px wide', worst < 0.01,
                      'largest shift %.4f of the picture' % worst)

            # ---- a drawing made by deck_draw.py: relabel, select, delete ----
            page.locator('section[data-no="03"] img').click()
            arrow_text = page.locator('#lightbox g[data-kind="arrow"] text')
            arrow_text.dblclick()
            page.locator('#lightbox .lb-label').fill('תווית חדשה')
            page.locator('#lightbox .lb-label').press('Enter')
            res.check('double click relabels a deck_draw.py arrow',
                      page.locator('section[data-no="03"] g[data-kind="arrow"] text').text_content() == 'תווית חדשה')
            page.locator('#lightbox g[data-kind="box"] text').click()
            page.keyboard.press('Delete')
            res.check('click + Delete removes a drawing',
                      page.locator('section[data-no="03"] g.dw').count() == 1)
            page.keyboard.press('Escape')

            # ---- clear one picture, then the whole deck ----
            page.locator('section[data-no="04"] img').click()
            page.locator('#lightbox .t-clr').click()
            page.keyboard.press('Escape')
            res.check('"clear picture" unwraps that picture only',
                      page.locator('section[data-no="04"] .drawn-on').count() == 0
                      and page.locator('section[data-no="02"] g.dw').count() == 2)
            page.locator('#btn-draw-clr').click()
            res.check('"clear drawings" removes every drawing',
                      page.locator('.slide .drawn-on').count() == 0 and not page.locator('#btn-draw-clr').is_visible())
            save(page)
            text = deck.text()
            res.check('saved after clearing: no drawings in the file', 'drawn-on' not in text and 'drawings' not in text)
            shot(page, shots, 'cleared')

            # ---- the JS and the Python write the same geometry ----
            cases = [('box', (100, 80), (400, 300), 'שלום', True, 583), ('box', (50, 5), (300, 200), 'top', False, 583),
                     ('arrow', (700, 500), (450, 250), 'a&b<c', False, 583), ('arrow', (100, 100), (100, 400), '', True, 2000),
                     ('arrow', (300, 300), (600, 280), 'ימינה', True, 2000), ('box', (30, 1820), (970, 1980), 'טלפון', True, 2000)]
            same = all(page.evaluate('a => window.deckDraw.shapeMarkup(a[0], {x:a[1][0], y:a[1][1]}, '
                                     '{x:a[2][0], y:a[2][1]}, a[3], a[4], a[5])', list(c))
                       == deck_draw.shape_markup(*c) for c in cases)
            res.check('draw.js and deck_draw.py write identical markup (6 cases, wide and tall)', same)
            browser.close()

        # ---- deck_draw.py: add then clear gives back the exact file ----
        before = deck.text()
        draw = [sys.executable, os.path.join(SCRIPTS, 'deck_draw.py'), deck.file]
        subprocess.check_call(draw + ['box', '--slide', '02', '--at', '5,5,20,20', '--label', 'x'], stdout=subprocess.DEVNULL)
        subprocess.check_call(draw + ['arrow', '--slide', '04', '--at', '50,50,20,20'], stdout=subprocess.DEVNULL)
        subprocess.check_call(draw + ['clear'], stdout=subprocess.DEVNULL)
        res.check('deck_draw.py add + clear returns the file byte for byte', deck.text() == before)
    finally:
        deck.close()


def compare(src, rev, res):
    """Save the same deck with edit.js at REV and with today's: the files must match."""
    old = tempfile.mkdtemp(prefix='deck-assets-')
    try:
        for f in os.listdir(SCRIPTS):
            if os.path.isfile(os.path.join(SCRIPTS, f)):
                shutil.copy(os.path.join(SCRIPTS, f), old)
        js = subprocess.check_output(['git', 'show', '%s:html-deck/scripts/edit.js' % rev], cwd=SCRIPTS)
        open(os.path.join(old, 'edit.js'), 'wb').write(js)
        outs = []
        for assets in (old, SCRIPTS):
            deck = DeckCopy(src, assets)
            try:
                with sync_playwright() as p:
                    b = p.chromium.launch()
                    page = b.new_page(viewport={'width': 1500, 'height': 950})
                    page.goto(deck.base + 'deck.html', wait_until='networkidle')
                    page.locator('section[data-no="02"] .facts .f .v').first.click()
                    save(page)
                    b.close()
                # the slide list's "here" mark: the old edit.js saved it (fixed in this round),
                # and which link has it depends on scroll timing -- not part of the refactor
                outs.append(re.sub(r'(<a href="#s\d+") class="here"', r'\1', deck.text()))
            finally:
                deck.close()
        res.check('refactor: a save with edit.js at %s and with the split files is byte-identical' % rev,
                  outs[0] == outs[1], '%d vs %d bytes' % (len(outs[0]), len(outs[1])))
    finally:
        shutil.rmtree(old, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('deck')
    ap.add_argument('--shots')
    ap.add_argument('--report')
    ap.add_argument('--compare-with')
    a = ap.parse_args()
    if a.shots:
        os.makedirs(a.shots, exist_ok=True)
    res, errors = Results('Drawings and full screen -- browser test'), []
    if a.compare_with:
        compare(a.deck, a.compare_with, res)
    run(a.deck, a.shots, res, errors)
    res.check('no page or console errors during the run', not errors, ' / '.join(errors[:5]))
    if a.report:
        os.makedirs(os.path.dirname(a.report), exist_ok=True)
        open(a.report, 'w', encoding='utf-8').write(res.markdown(
            'None. A copy of a real deck (built with deck_new.py, screen_mock.py, deck_draw.py) '
            'served by serve.py, driven in headless Chromium. Confirm dialogs are accepted.'))
    print('\n%d passed, %d failed' % (len(res.rows) - len(res.failed()), len(res.failed())))
    return 1 if res.failed() else 0


if __name__ == '__main__':
    sys.exit(main())
