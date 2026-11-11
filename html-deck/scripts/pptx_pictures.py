# -*- coding: utf-8 -*-
"""Pictures and their drawings for the editable pptx (to_pptx_native.py).

MEASURE_JS in to_pptx_native.py reads boxes and text only, so a slide picture never
reached the editable pptx at all, and a drawing over it had nothing to sit on. This
adds both: each <img> is shot from the page and placed as a pptx picture, and each
drawing (draw.js / deck_draw.py) is rebuilt from native shapes on top of it -- a box is
an outlined rectangle, an arrow a line with an arrowhead, a label a text box -- so they
can still be moved and retyped in PowerPoint.
"""
import io

from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Pt

PX = 9525

# Runs in the page after MEASURE_JS. Per slide: its pictures (in document order across
# the deck, so the shot of picture i is `section.slide img` number i) and its drawings.
MEASURE_JS = r"""
() => {
  const all = [...document.querySelectorAll('section.slide img')];
  return [...document.querySelectorAll('section.slide')].map(s => {
    const sr = s.getBoundingClientRect(), ox = sr.left, oy = sr.top;
    const at = (svg, x, y) => {
      const p = svg.createSVGPoint(); p.x = x; p.y = y;
      const q = p.matrixTransform(svg.getScreenCTM());
      return {x: q.x - ox, y: q.y - oy};
    };
    const pics = [...s.querySelectorAll('img')].map(img => {
      const b = img.getBoundingClientRect();
      return {i: all.indexOf(img), x: b.left - ox, y: b.top - oy, w: b.width, h: b.height};
    }).filter(p => p.w > 0 && p.h > 0);
    const drawings = [];
    s.querySelectorAll('svg.drawings').forEach(svg => {
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      svg.querySelectorAll('g.dw').forEach(g => {
        const r = g.querySelector('rect'), l = g.querySelector('line'), t = g.querySelector('text');
        const d = {kind: g.dataset.kind, color: (r || l).getAttribute('stroke')};
        if (r) {
          d.sw = +r.getAttribute('stroke-width') * scale;
          const a = at(svg, +r.getAttribute('x'), +r.getAttribute('y'));
          const b = at(svg, +r.getAttribute('x') + +r.getAttribute('width'),
                            +r.getAttribute('y') + +r.getAttribute('height'));
          Object.assign(d, {x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y});
        } else if (l) {
          d.sw = +l.getAttribute('stroke-width') * scale;
          const tip = g.querySelector('polygon').getAttribute('points').split(' ').map(Number);
          const a = at(svg, +l.getAttribute('x1'), +l.getAttribute('y1'));
          const b = at(svg, tip[0], tip[1]);
          Object.assign(d, {x1: a.x, y1: a.y, x2: b.x, y2: b.y});
        }
        if (t) {
          const tb = t.getBoundingClientRect();
          d.label = {text: t.textContent, x: tb.left - ox, y: tb.top - oy, w: tb.width, h: tb.height,
                     size: +t.getAttribute('font-size') * scale, color: t.getAttribute('fill')};
        }
        drawings.push(d);
      });
    });
    return {pics, drawings};
  });
}
"""

HIDE_DRAWINGS_CSS = 'svg.drawings{display:none!important}'


def shoot(page, measured):
    """PNG bytes of every measured slide picture, by its index, drawings hidden (they are
    added as shapes). Stored on each slide's entry as 'shots'."""
    page.add_style_tag(content=HIDE_DRAWINGS_CSS)
    imgs = page.locator('section.slide img')
    for x in measured:
        x['shots'] = {p['i']: imgs.nth(p['i']).screenshot(animations='disabled') for p in x['pics']}


def _rgb(hexcolor):
    return RGBColor.from_string(hexcolor.lstrip('#').upper())


def _emu(px, k, off):
    return Emu(int(round(px * k * PX)) + off)


def add_to_slide(slide, extra, k, off):
    """Place the slide's pictures, then its drawings over them."""
    for p in extra['pics']:
        slide.shapes.add_picture(io.BytesIO(extra['shots'][p['i']]), _emu(p['x'], k, off[0]),
                                 _emu(p['y'], k, off[1]), _emu(p['w'], k, 0), _emu(p['h'], k, 0))
    for d in extra['drawings']:
        line_w = Pt(max(0.75, d['sw'] * k * 0.75))
        if d['kind'] == 'box':
            sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, _emu(d['x'], k, off[0]), _emu(d['y'], k, off[1]),
                                        _emu(d['w'], k, 0), _emu(d['h'], k, 0))
            sh.fill.background()
            sh.line.color.rgb = _rgb(d['color'])
            sh.line.width = line_w
            sh.shadow.inherit = False
        else:
            c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, _emu(d['x1'], k, off[0]), _emu(d['y1'], k, off[1]),
                                           _emu(d['x2'], k, off[0]), _emu(d['y2'], k, off[1]))
            c.line.color.rgb = _rgb(d['color'])
            c.line.width = line_w
            ln = c.line._get_or_add_ln()
            ln.append(ln.makeelement(qn('a:tailEnd'), {'type': 'triangle', 'w': 'med', 'len': 'med'}))
        if d.get('label'):
            add_label(slide, d['label'], k, off)


def add_label(slide, t, k, off):
    slack = t['h'] * 0.6        # PowerPoint's font is rarely the browser's: leave room
    tb = slide.shapes.add_textbox(_emu(t['x'] - slack / 2, k, off[0]), _emu(t['y'], k, off[1]),
                                  _emu(t['w'] + slack, k, 0), _emu(t['h'], k, 0))
    tf = tb.text_frame
    tf.word_wrap = False
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    if any('֐' <= ch <= 'ۿ' for ch in t['text']):
        p._p.get_or_add_pPr().set('rtl', '1')
    run = p.add_run()
    run.text = t['text']
    run.font.bold = True
    run.font.size = Pt(max(4, t['size'] * k * 0.75))
    run.font.color.rgb = _rgb(t['color'])
    # the white halo the browser paints behind the letters, as a thin white outline
    rpr = run._r.get_or_add_rPr()
    halo = rpr.makeelement(qn('a:ln'), {'w': str(int(Pt(0.75)))})
    fill = halo.makeelement(qn('a:solidFill'), {})
    fill.append(fill.makeelement(qn('a:srgbClr'), {'val': 'FFFFFF'}))
    halo.append(fill)
    rpr.insert(0, halo)


def sheet_draw(d, extra, k, oy):
    """Paint pictures (grey) and drawings (their colour) onto the Pillow contact sheet."""
    for p in extra['pics']:
        d.rectangle([p['x'] * k, p['y'] * k + oy, (p['x'] + p['w']) * k, (p['y'] + p['h']) * k + oy],
                    fill=(205, 212, 220), outline=(150, 160, 172))
    for g in extra['drawings']:
        col = tuple(_rgb(g['color']))
        if g['kind'] == 'box':
            d.rectangle([g['x'] * k, g['y'] * k + oy, (g['x'] + g['w']) * k, (g['y'] + g['h']) * k + oy],
                        outline=col, width=2)
        else:
            d.line([g['x1'] * k, g['y1'] * k + oy, g['x2'] * k, g['y2'] * k + oy], fill=col, width=2)
        if g.get('label'):
            t = g['label']
            d.text((t['x'] * k, t['y'] * k + oy), t['text'], fill=col)
