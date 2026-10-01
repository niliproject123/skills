#!/usr/bin/env python
"""to_pptx_native.py -- an *editable* pptx from an HTML deck.

``to_pptx.py`` puts a picture of each slide on a pptx page: faithful, not editable.
This one measures the rendered deck in headless Chromium -- every box that paints a
background or a border, every run of text with its font, size, weight and colour, at
its exact position -- and rebuilds each slide from native PowerPoint shapes: rectangles
and text boxes. Every line is real text the reader can click and rewrite.

What is kept: geometry, fills, borders, corner radius, text (bold, colour, size),
RTL direction, alignment. What is not: shadows, gradients (the first colour is used),
web-font rendering (the run names the CSS family; PowerPoint substitutes if it is not
installed), and line breaks may fall a word earlier or later than in the browser.

    python to_pptx_native.py <deck-folder> <out.pptx> --decks screens.html [--base http://127.0.0.1:8901/]

The deck server must be running (the decks link /_deck/deck.css). A slide taller than
720px is scaled down to fit the page, like the picture exporter does.
"""
import argparse
import os
import re
import sys
import urllib.request

from playwright.sync_api import sync_playwright
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from pptx.util import Emu, Pt

sys.stdout.reconfigure(encoding='utf-8')

PX = 9525                    # EMU per CSS px at 96 dpi: 1280px == 13.333in
SLIDE_W, SLIDE_H = 1280, 720
PAPER = 'E9EDF2'

CAPTURE_CSS = """
#deckbar,#bar,#drawer,#slidebar,.undo-btn,[data-chrome]{display:none!important}
body{padding:0!important;margin:0!important;background:#E9EDF2!important}
*{scrollbar-width:none!important;box-shadow:none!important;text-shadow:none!important}
.slide{zoom:1!important;margin:0!important}
.updated,.edited,.has-note,[data-updated]{background:inherit!important;box-shadow:none!important}
[data-cut]{display:none!important}
"""

# The reader's remarks are review chrome, not deck content: a deleted line ([data-cut]) is
# dropped, and an inline remark "מיכאל: ..." / "michael: ..." is cut off the text node it sits in.
STRIP_REMARKS_JS = r"""
() => {
  document.querySelectorAll('[data-cut]').forEach(e => e.remove());
  const re = /\s*(?:michael|מיכאל)\s*:.*$/is;
  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  let n, cut = 0;
  while ((n = it.nextNode())) { if (re.test(n.textContent)) { n.textContent = n.textContent.replace(re, ''); cut++; } }
  return cut;
}
"""

# Runs in the page. Walks each slide and lists, in paint order, the boxes and the text.
MEASURE_JS = r"""
() => {
  const NONE = c => !c || c === 'transparent' || /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\)$/.test(c);
  const num = v => parseFloat(v) || 0;
  const out = [];
  document.querySelectorAll('section.slide').forEach(s => {
    const sr = s.getBoundingClientRect(); const ox = sr.left, oy = sr.top;
    const shapes = [];
    const box = (el, cs) => {
      const b = el.getBoundingClientRect();
      const bg = NONE(cs.backgroundColor) ? null : cs.backgroundColor;
      let grad = null;
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        const m = cs.backgroundImage.match(/rgba?\([^)]*\)/); if (m) grad = m[0];
      }
      const sides = ['Top','Right','Bottom','Left'].map(k => ({
        w: cs['border'+k+'Style'] === 'none' ? 0 : num(cs['border'+k+'Width']), c: cs['border'+k+'Color']}));
      const uniform = sides.every(x => x.w === sides[0].w && x.c === sides[0].c);
      const fill = bg || grad;
      if (fill || sides.some(x => x.w > 0)) {
        const r = {t:'rect', x:b.left-ox, y:b.top-oy, w:b.width, h:b.height, fill,
                   radius: num(cs.borderTopLeftRadius), border: null, sides: null};
        if (uniform && sides[0].w > 0) r.border = {w: sides[0].w, c: sides[0].c};
        else if (!uniform) r.sides = sides;
        shapes.push(r);
      }
      return b;
    };
    const runsOf = (el, style, acc) => {
      for (const n of el.childNodes) {
        if (n.nodeType === 3) { if (n.textContent) acc.push(Object.assign({text: n.textContent}, style)); }
        else if (n.nodeType === 1) {
          const c = getComputedStyle(n);
          if (c.display === 'none' || c.visibility === 'hidden') continue;
          if (n.tagName === 'BR') { acc.push(Object.assign({text: '\n'}, style)); continue; }
          box(n, c);
          runsOf(n, {bold: parseInt(c.fontWeight) >= 600, italic: c.fontStyle === 'italic',
                     color: c.color, size: num(c.fontSize), font: c.fontFamily}, acc);
        }
      }
    };
    const textOf = (el, cs, b) => {
      const rg = document.createRange(); rg.selectNodeContents(el);
      const tb = rg.getBoundingClientRect();
      const pl = num(cs.paddingLeft), pr = num(cs.paddingRight);
      const runs = [];
      runsOf(el, {bold: parseInt(cs.fontWeight) >= 600, italic: cs.fontStyle === 'italic',
                  color: cs.color, size: num(cs.fontSize), font: cs.fontFamily}, runs);
      const text = runs.map(r => r.text).join('');
      if (!text.trim()) return;
      shapes.push({t:'text', x: b.left-ox+pl, y: tb.top-oy, w: Math.max(b.width-pl-pr, tb.width), h: tb.height,
                   runs, align: cs.textAlign, dir: cs.direction, lh: num(cs.lineHeight) || num(cs.fontSize)*1.3,
                   size: num(cs.fontSize)});
    };
    const walk = el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (['SCRIPT','STYLE'].includes(el.tagName)) return;
      const b = box(el, cs);
      if (b.width < 1 || b.height < 1) return;
      const kids = [...el.children];
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      const inlineOnly = kids.every(k => { const d = getComputedStyle(k).display; return d === 'inline' || d === 'inline-block' || d === 'none'; });
      if (hasText && inlineOnly) { textOf(el, cs, b); return; }
      if (!hasText && kids.length && inlineOnly && kids.some(k => k.textContent.trim())) { textOf(el, cs, b); return; }
      if (hasText) {   // text mixed with block children: each direct text node on its own
        for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) {
          const rg = document.createRange(); rg.selectNodeContents(n); const tb = rg.getBoundingClientRect();
          shapes.push({t:'text', x: tb.left-ox, y: tb.top-oy, w: tb.width+2, h: tb.height,
                       runs: [{text: n.textContent, bold: parseInt(cs.fontWeight) >= 600, italic: false, color: cs.color, size: num(cs.fontSize), font: cs.fontFamily}],
                       align: cs.textAlign, dir: cs.direction, lh: num(cs.lineHeight) || num(cs.fontSize)*1.3, size: num(cs.fontSize)});
        }
      }
      kids.forEach(walk);
    };
    walk(s);
    const blocks = [...s.children].map(c => { const b = c.getBoundingClientRect(); return {y: b.top - oy, h: b.height}; }).filter(b => b.h > 0);
    out.push({no: s.dataset.no || '??', name: s.dataset.name || '', w: sr.width, h: sr.height, shapes, blocks});
  });
  return out;
}
"""


def rgb(css):
    m = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)', css or '')
    return RGBColor(int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None


def emu(px, k):
    return Emu(int(round(px * k * PX)))


def add_rect(slide, r, k, off):
    if r['w'] <= 0 or r['h'] <= 0:
        return
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if r['radius'] > 0 else MSO_SHAPE.RECTANGLE
    sh = slide.shapes.add_shape(kind, emu(r['x'], k) + off[0], emu(r['y'], k) + off[1], emu(r['w'], k), emu(r['h'], k))
    if r['radius'] > 0:
        sh.adjustments[0] = min(0.5, r['radius'] / max(1.0, min(r['w'], r['h'])))
    fill = rgb(r['fill']) if r['fill'] else None
    if fill:
        sh.fill.solid(); sh.fill.fore_color.rgb = fill
    else:
        sh.fill.background()
    if r['border'] and rgb(r['border']['c']):
        sh.line.color.rgb = rgb(r['border']['c']); sh.line.width = Pt(max(0.5, r['border']['w'] * 0.75))
    else:
        sh.line.fill.background()
    sh.shadow.inherit = False
    sh.text_frame.text = ''
    if r['sides']:   # a coloured edge on one side: draw it as its own thin bar
        for i, s in enumerate(r['sides']):
            if s['w'] <= 0 or not rgb(s['c']):
                continue
            x, y, w, h = r['x'], r['y'], r['w'], r['h']
            bar = [(x, y, w, s['w']), (x + w - s['w'], y, s['w'], h), (x, y + h - s['w'], w, s['w']), (x, y, s['w'], h)][i]
            b = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, emu(bar[0], k) + off[0], emu(bar[1], k) + off[1], emu(bar[2], k), emu(bar[3], k))
            b.fill.solid(); b.fill.fore_color.rgb = rgb(s['c']); b.line.fill.background(); b.shadow.inherit = False


def add_text(slide, t, k, off):
    if t['w'] <= 0 or t['h'] <= 0:
        return
    tb = slide.shapes.add_textbox(emu(t['x'], k) + off[0], emu(t['y'] - 1, k) + off[1], emu(t['w'], k), emu(t['h'] + 2, k))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.TOP
    rtl = t['dir'] == 'rtl'
    align = {'left': PP_ALIGN.LEFT, 'right': PP_ALIGN.RIGHT, 'center': PP_ALIGN.CENTER, 'justify': PP_ALIGN.JUSTIFY}.get(
        t['align'], PP_ALIGN.RIGHT if rtl else PP_ALIGN.LEFT)
    if t['align'] in ('start', ''):
        align = PP_ALIGN.RIGHT if rtl else PP_ALIGN.LEFT
    if t['align'] == 'end':
        align = PP_ALIGN.LEFT if rtl else PP_ALIGN.RIGHT
    paras = [[]]
    for r in t['runs']:
        parts = r['text'].split('\n')
        for i, part in enumerate(parts):
            if i:
                paras.append([])
            if part:
                paras[-1].append(dict(r, text=part))
    first = True
    for runs in paras:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.alignment = align
        p.line_spacing = max(0.8, t['lh'] / max(1.0, t['size']))
        if rtl:
            p._p.get_or_add_pPr().set('rtl', '1')
        for r in runs:
            text = re.sub(r'[ \t\r\n]+', ' ', r['text'])
            if not text:
                continue
            run = p.add_run()
            run.text = text
            f = run.font
            f.size = Pt(max(4, r['size'] * k * 0.75))
            f.bold = bool(r['bold'])
            f.italic = bool(r['italic'])
            c = rgb(r['color'])
            if c:
                f.color.rgb = c
            fam = (r['font'] or '').split(',')[0].strip().strip('"\'')
            if fam:
                f.name = fam
                rpr = run._r.get_or_add_rPr()
                for tag in ('a:latin', 'a:cs'):
                    el = rpr.find(qn(tag))
                    if el is None:
                        el = rpr.makeelement(qn(tag), {})
                        rpr.append(el)
                    el.set('typeface', fam)


def pages(s):
    """(y0, y1, scale) per pptx page. One page per slide, always: a slide up to 720px at
    100%, a taller one scaled down to fit -- the same rule as the picture exporter.
    Splitting (``pages_split``) left a near-empty second page for every tall slide."""
    h = s['h']
    return [(0, h, min(1.0, (SLIDE_H - 8) / max(1.0, h - 4)))]


def pages_split(s):
    """Former rule, kept for reference: cut a tall slide between its top-level blocks."""
    h = s['h']
    if h - 4 <= SLIDE_H:
        return [(0, h, 1.0)]
    # a cut is allowed where no text line and no small box (a cell, a pill, a card
    # under 240px) is split; big containers are simply clipped on both pages
    atoms = [(sh['y'], sh['y'] + sh['h']) for sh in s['shapes'] if sh['t'] == 'text' or sh['h'] < 240]
    def splits(y):
        return any(a < y - 2 and b > y + 2 for a, b in atoms)
    out, y0 = [], 0
    while y0 < h - 4:
        limit = y0 + SLIDE_H - 8
        if h - y0 - 4 <= SLIDE_H - 8:
            y1 = h
        else:
            y1 = next((y for y in range(int(limit), int(y0) + 200, -2) if not splits(y)), None)
            if y1 is None:   # a single block taller than a page: take it whole, scaled
                y1 = next((y for y in range(int(limit), int(h), 2) if not splits(y)), h)
        k = min(1.0, (SLIDE_H - 8) / max(1.0, y1 - y0))
        out.append((y0, y1, k))
        y0 = y1
    return out


def clip(sh, y0, y1):
    """The part of a shape inside [y0, y1): rects are trimmed, text goes to the page its
    top line is on."""
    top, bot = sh['y'], sh['y'] + sh['h']
    if sh['t'] == 'text':
        return sh if y0 <= top < y1 else None
    if bot <= y0 or top >= y1:
        return None
    if top >= y0 and bot <= y1:
        return sh
    c = dict(sh); c['y'] = max(top, y0); c['h'] = min(bot, y1) - c['y']
    if c['h'] < 1:
        return None
    if top < y0 or bot > y1:
        c['radius'] = 0
    return c


def build(measured, out, title):
    prs = Presentation()
    prs.slide_width, prs.slide_height = Emu(SLIDE_W * PX), Emu(SLIDE_H * PX)
    if title:
        prs.core_properties.title = title
    blank = prs.slide_layouts[6]
    tall = []
    for deck, slides in measured:
        for s in slides:
            for pi, (y0, y1, k) in enumerate(pages(s)):
                if k < 1:
                    tall.append((deck, s['no'], k))
                ph = (y1 - y0) * k
                off = (Emu(int((SLIDE_W - s['w'] * k) / 2 * PX)), Emu(int((SLIDE_H - ph) / 2 * PX)) - emu(y0, k))
                slide = prs.slides.add_slide(blank)
                slide.background.fill.solid(); slide.background.fill.fore_color.rgb = RGBColor.from_string(PAPER)
                for sh in s['shapes']:
                    sh = clip(sh, y0, y1)
                    if sh:
                        (add_rect if sh['t'] == 'rect' else add_text)(slide, sh, k, off)
                print('  %s %s%s %-28s %3d shapes%s' % (deck, s['no'], chr(97 + pi) if pi or y1 < s['h'] - 4 else ' ', s['name'][:28],
                                                        len(s['shapes']), '  scaled %.0f%%' % (k * 100) if k < 1 else ''))
    prs.save(out)
    return tall


def sheet(measured, out, cols=4):
    """Paint the measured shapes with Pillow: a check of what was measured, not of
    PowerPoint's rendering. Hebrew is drawn with libraqm when Pillow has it."""
    from PIL import Image, ImageDraw, ImageFont, features
    raqm = features.check('raqm')
    W, H, S = 640, 360, 0.5
    slides = [(s, pg) for _, ss in measured for s in ss for pg in pages(s)]
    rows = (len(slides) + cols - 1) // cols
    img = Image.new('RGB', (cols * W, rows * H), '#808080')
    fonts = {}
    def font(px, bold):
        key = (int(px), bold)
        if key not in fonts:
            for name in (('arialbd.ttf' if bold else 'arial.ttf'), 'segoeui.ttf'):
                try:
                    fonts[key] = ImageFont.truetype('C:/Windows/Fonts/' + name, max(5, int(px))); break
                except OSError:
                    fonts[key] = ImageFont.load_default()
        return fonts[key]
    for i, (s, (y0, y1, k)) in enumerate(slides):
        k = k * S
        ox, oy = (i % cols) * W, (i // cols) * H
        page = Image.new('RGB', (W, H), '#' + PAPER); d = ImageDraw.Draw(page)
        oy_page = (H - (y1 - y0) * k) / 2 - y0 * k
        for sh in s['shapes']:
            sh = clip(sh, y0, y1)
            if not sh: continue
            x, y, w, h = sh['x'] * k, sh['y'] * k + oy_page, sh['w'] * k, sh['h'] * k
            if sh['t'] == 'rect':
                fill = rgb(sh['fill']) if sh['fill'] else None
                outline = rgb(sh['border']['c']) if sh['border'] else None
                d.rectangle([x, y, x + w, y + h], fill=tuple(fill) if fill else None, outline=tuple(outline) if outline else None)
            else:
                text = ''.join(r['text'] for r in sh['runs']); text = re.sub(r'\s+', ' ', text).strip()
                r0 = sh['runs'][0]; f = font(r0['size'] * k, r0['bold']); c = rgb(r0['color']) or RGBColor(0, 0, 0)
                kw = {'direction': 'rtl'} if raqm and sh['dir'] == 'rtl' else {}
                anchor_x = x + w if sh['dir'] == 'rtl' else x
                try:
                    d.text((anchor_x, y), text, fill=tuple(c), font=f, anchor='ra' if sh['dir'] == 'rtl' else 'la', **kw)
                except (ValueError, KeyError):
                    d.text((x, y), text, fill=tuple(c), font=f)
        d.text((4, 2), s['no'], fill='red', font=font(14, True))
        img.paste(page, (ox, oy))
    img.save(out)
    return raqm


def deck_title(base, deck):
    with urllib.request.urlopen(base + deck, timeout=5) as r:
        m = re.search(r'<title>(.*?)</title>', r.read().decode('utf-8', 'replace'), re.S)
    return m.group(1).strip() if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('folder')
    ap.add_argument('out')
    ap.add_argument('--decks', help='comma-separated, in order; default every .html in the folder')
    ap.add_argument('--base', default='http://127.0.0.1:8901/')
    ap.add_argument('--title')
    ap.add_argument('--sheet', help='PNG contact sheet painted from the measured shapes')
    a = ap.parse_args()
    decks = a.decks.split(',') if a.decks else sorted(f for f in os.listdir(a.folder) if f.endswith('.html'))
    try:
        urllib.request.urlopen(a.base + decks[0], timeout=5)
    except Exception as e:
        raise SystemExit('deck server not reachable at %s (%s) -- start serve.py first' % (a.base, e))
    measured = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        for deck in decks:
            page = ctx.new_page()
            page.goto(a.base + deck, wait_until='networkidle')
            page.add_style_tag(content=CAPTURE_CSS)
            remarks = page.evaluate(STRIP_REMARKS_JS)
            if remarks:
                print('%s: %d remark(s) left out' % (deck, remarks))
            page.evaluate('document.fonts.ready')
            page.wait_for_timeout(400)
            slides = page.evaluate(MEASURE_JS)
            if not slides:
                raise SystemExit('no slides in ' + deck)
            measured.append((deck, slides))
            page.close()
        browser.close()
    title = a.title or deck_title(a.base, decks[0])
    tall = build(measured, a.out, title)
    n = sum(len(s) for _, s in measured)
    print('%d slides -> %s' % (n, a.out))
    for deck, no, k in tall:
        print('  scaled to fit: %s slide %s at %.0f%%' % (deck, no, k * 100))
    if a.sheet:
        raqm = sheet(measured, a.sheet)
        print('sheet -> %s%s' % (a.sheet, '' if raqm else '  (no libraqm: Hebrew drawn without shaping, glyph order may look reversed)'))


if __name__ == '__main__':
    main()
