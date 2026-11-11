# -*- coding: utf-8 -*-
"""Do the drawings reach the pptx (picture and editable) and the pdf?

    python tests/drawings_export_test.py <deck-folder> [--out DIR] [--report FILE]

<deck-folder>: the example deck in discussions/11.26-deck-drawings/example-deck --
slide 02 has a picture and no drawing, slide 03 a box and an arrow with labels, slide 04
a box on a png. The deck is copied and served; the exporters are run as a reader would
run them. --out keeps the three exported files.

What is checked:
  picture pptx  (to_pptx.py)         slide 03/04 shots hold the drawing red, slide 02 none
  editable pptx (to_pptx_native.py)  every picture is placed; boxes are red outlined
                                     rectangles, arrows connectors with an arrowhead,
                                     labels text boxes with the label's words
  pdf           (Chromium print, the deck's own print css)  the same red and the labels' words

What is mocked: nothing. Red is counted as pixels near #E5484D; the example screens use
no red of their own, so slide 02 is the control.
"""
import argparse
import io
import os
import shutil
import subprocess
import sys

from deck_harness import SCRIPTS, DeckCopy, Results, watch_errors
from playwright.sync_api import sync_playwright
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.oxml.ns import qn

LABELS = {'03': ['כמה התראות פתוחות', 'כאן הקו קופץ'], '04': ['הכפתור הראשי']}
RED = (0xE5, 0x48, 0x4D)


def red_pixels(png_bytes):
    from PIL import Image
    im = Image.open(io.BytesIO(png_bytes)).convert('RGB')
    im.thumbnail((900, 900))
    return sum(1 for p in im.get_flattened_data() if all(abs(a - b) < 40 for a, b in zip(p, RED)))


def picture_pptx(deck, out, res):
    subprocess.check_call([sys.executable, os.path.join(SCRIPTS, 'to_pptx.py'), deck.folder, out,
                           '--port', str(deck.port)], stdout=subprocess.DEVNULL)
    prs = Presentation(out)
    reds = {}
    for no, slide in zip(['01', '02', '03', '04'], prs.slides):
        pics = [s for s in slide.shapes if s.shape_type == MSO_SHAPE_TYPE.PICTURE]
        reds[no] = sum(red_pixels(p.image.blob) for p in pics)
    res.check('picture pptx: 4 slides', len(prs.slides) == 4, '%d slides' % len(prs.slides))
    res.check('picture pptx: drawings on 03 and 04, none on 02',
              reds['03'] > 300 and reds['04'] > 150 and reds['02'] < 20, 'red pixels %s' % reds)


def editable_pptx(deck, out, res):
    subprocess.check_call([sys.executable, os.path.join(SCRIPTS, 'to_pptx_native.py'), deck.folder, out,
                           '--decks', 'deck.html', '--base', deck.base], stdout=subprocess.DEVNULL)
    prs = Presentation(out)
    slides = dict(zip(['01', '02', '03', '04'], prs.slides))
    for no, want_box, want_arrow in (('02', 0, 0), ('03', 1, 1), ('04', 1, 0)):
        sh = list(slides[no].shapes)
        pics = [s for s in sh if s.shape_type == MSO_SHAPE_TYPE.PICTURE]
        boxes = [s for s in sh if s.shape_type == MSO_SHAPE_TYPE.AUTO_SHAPE and s.line.fill.type == 1
                 and str(s.line.color.rgb) == 'E5484D']
        arrows = [s for s in sh if s.shape_type == MSO_SHAPE_TYPE.LINE
                  and s.line._ln.find(qn('a:tailEnd')) is not None and str(s.line.color.rgb) == 'E5484D']
        words = [s.text_frame.text for s in sh if s.has_text_frame]
        labels_ok = all(l in words for l in LABELS.get(no, []))
        res.check('editable pptx %s: 1 picture, %d box, %d arrow, labels as text' % (no, want_box, want_arrow),
                  len(pics) == 1 and len(boxes) == want_box and len(arrows) == want_arrow and labels_ok,
                  'pictures %d, boxes %d, arrows %d, labels found %s'
                  % (len(pics), len(boxes), len(arrows), labels_ok))


def pdf(deck, out, res, errors):
    import pymupdf as fitz
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={'width': 1500, 'height': 950})
        watch_errors(page, errors)
        page.goto(deck.base + 'deck.html', wait_until='networkidle')
        page.emulate_media(media='print')
        page.pdf(path=out, width='1280px', height='720px', print_background=True)
        b.close()
    doc = fitz.open(out)
    res.check('pdf: one page per slide', doc.page_count == 4, '%d pages' % doc.page_count)
    reds, texts = {}, {}
    for no, pg in zip(['01', '02', '03', '04'], doc):
        reds[no] = red_pixels(pg.get_pixmap(dpi=72).tobytes('png'))
        texts[no] = pg.get_text()
    doc.close()
    res.check('pdf: drawings on 03 and 04, none on 02', reds['03'] > 300 and reds['04'] > 150 and reds['02'] < 20,
              'red pixels %s' % reds)
    # a pdf hands right-to-left words back last word first: accept either order
    found = all(l in texts[no] or ' '.join(reversed(l.split())) in texts[no] for no in LABELS for l in LABELS[no])
    res.check('pdf: label words are real text', found)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('deck')
    ap.add_argument('--out')
    ap.add_argument('--report')
    a = ap.parse_args()
    res, errors = Results('Drawings in the exports -- pptx (picture, editable) and pdf'), []
    deck = DeckCopy(a.deck)
    try:
        files = {k: os.path.join(deck.dir, 'drawings.' + k) for k in ('picture.pptx', 'editable.pptx', 'pdf')}
        picture_pptx(deck, files['picture.pptx'], res)
        editable_pptx(deck, files['editable.pptx'], res)
        pdf(deck, files['pdf'], res, errors)
        res.check('no page or console errors while printing', not errors, ' / '.join(errors[:5]))
        if a.out:
            os.makedirs(a.out, exist_ok=True)
            for f in files.values():
                shutil.copy(f, a.out)
    finally:
        deck.close()
    if a.report:
        os.makedirs(os.path.dirname(a.report), exist_ok=True)
        open(a.report, 'w', encoding='utf-8').write(res.markdown(
            'None. The real exporters (to_pptx.py, to_pptx_native.py, Chromium print) on a copy of '
            'a real deck served by serve.py.'))
    print('\n%d passed, %d failed' % (len(res.rows) - len(res.failed()), len(res.failed())))
    return 1 if res.failed() else 0


if __name__ == '__main__':
    sys.exit(main())
