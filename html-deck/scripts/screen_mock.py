#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Drawn mockups of an app's screens, as svg - and a way to look at them before the reader does.

A slide about a screen shows the screen. Where a `.mock` built from deck markup is too plain
(a chart, a dark theme, a dialog over a graph), the deck draws it as svg: `screens/*.svg`,
written by the deck's own `build_screens.py` from these primitives.

The rules the primitives are built around:
  * labels, colours and layout come from the app's code - read them, never recall them
  * no user data: `bar()` stands where the app shows a name, a date or a number, and
    `wave()` draws a line's shape, not a price. A typed number on a mockup is believed
  * every picture carries `.mock-cap` underneath saying it is a drawing

Library
    import sys; sys.path.insert(0, r'<skill>/scripts'); from screen_mock import *
    T = theme(bg='#0d1117', paper='#161b22', accent='#00e5ff')   # from the app's theme file
    svg(1200, 700, rect(...) + text(...) + chips(...)[0], T)

Command line
    python screen_mock.py preview <deck-folder>     # screens/*.svg -> .preview/*.png, and
                                                    # a refusal for any svg that does not parse
"""
import argparse
import math
import re
import sys
import xml.dom.minidom
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

FONT = "font-family='Roboto,Segoe UI,Arial,sans-serif'"
SERIES = ['#00e676', '#ff1f8f', '#1e88ff', '#ffe11a', '#ff5a1f', '#7c4dff', '#18e0d0']
CALLOUT = '#ffd700'


def theme(bg='#0d1117', paper='#161b22', line='#30363d', text='#e6edf3', muted='#9198a1',
          accent='#00e5ff', skeleton='#2b323c', series=None):
    """the app's own palette - pass the values from its theme file"""
    return dict(bg=bg, paper=paper, line=line, text=text, muted=muted, accent=accent,
                skeleton=skeleton, series=series or SERIES)


DARK = theme()


# ---------- shapes ----------
def rect(x, y, w, h, fill='none', stroke='none', r=6, extra=''):
    return ("<rect x='%g' y='%g' width='%g' height='%g' rx='%g' fill='%s' stroke='%s' %s/>"
            % (x, y, w, h, r, fill, stroke, extra))


def line(x1, y1, x2, y2, stroke, width=1, dash=''):
    return ("<line x1='%g' y1='%g' x2='%g' y2='%g' stroke='%s' stroke-width='%g' %s/>"
            % (x1, y1, x2, y2, stroke, width, "stroke-dasharray='%s'" % dash if dash else ''))


def text(x, y, s, size=13, fill='#e6edf3', weight=400, anchor='start'):
    """a label from the app's code. `&` is escaped; `&#x2630;`-style icons pass through"""
    s = re.sub(r'&(?!#x?[0-9A-Fa-f]+;|[a-z]+;)', '&amp;', s).replace('<', '&lt;')
    return ("<text x='%g' y='%g' font-size='%g' fill='%s' font-weight='%d' text-anchor='%s'>%s</text>"
            % (x, y, size, fill, weight, anchor, s))


def width_of(s, size):
    """a rough text width - good enough to size a chip around its label"""
    return len(s) * size * 0.56


def bar(x, y, w, h=8, fill=None, t=DARK):
    """stands where the app shows the reader's own data: a name, a date, a number"""
    return rect(x, y, w, h, fill or t['skeleton'], r=h / 2)


# ---------- controls ----------
def chip(x, y, label, on=False, color=None, size=12, h=24, filled=True, t=DARK):
    """a tab, a toggle button or a chip. Returns (svg, width)"""
    color = color or t['accent']
    w = width_of(label, size) + 20
    if on and filled:
        out = rect(x, y, w, h, color, r=4) + text(x + w / 2, y + h * 0.68, label, size, t['bg'], 700, 'middle')
    else:
        out = (rect(x, y, w, h, 'none', color if on else t['line'], r=4)
               + text(x + w / 2, y + h * 0.68, label, size, color if on else t['muted'], 500, 'middle'))
    return out, w


def chips(x, y, labels, on=(), color=None, gap=6, **kw):
    """a row of chips. Returns (svg, x after the last one)"""
    out = ''
    for lb in labels:
        s, w = chip(x, y, lb, lb in on, color, **kw)
        out += s
        x += w + gap
    return out, x


def toggle(x, y, label, on=False, color=None, t=DARK):
    """a switch with its label. Returns (svg, x after it)"""
    color = color or t['accent']
    track = rect(x, y + 4, 30, 12, color if on else '#5a6370', r=6, extra="opacity='0.55'")
    knob = "<circle cx='%g' cy='%g' r='8' fill='%s'/>" % (x + (22 if on else 8), y + 10, color if on else '#d0d4d9')
    return track + knob + text(x + 38, y + 14, label, 12, t['muted']), x + 38 + width_of(label, 12) + 18


def field(x, y, w, label, value_w=None, h=38, t=DARK, value=None):
    """an outlined text field: its label from the code, its value a bar unless it is a fixed word"""
    out = rect(x, y, w, h, 'none', t['line'], 4) + text(x + 10, y - 4, label, 10, t['muted'])
    if value is not None:
        return out + text(x + 14, y + h * 0.63, value, 13, t['text'])
    return out + bar(x + 14, y + h / 2 - 4, value_w or w * 0.35, t=t)


def tabs(x, y, names, active, t=DARK, size=13, h=34):
    """the app's tab row. Returns (svg, x after it)"""
    out = ''
    for nm in names:
        w = width_of(nm, size) + 30
        on = nm == active
        out += rect(x, y, w, h, t['paper'] if on else 'none', t['accent'] if on else t['line'], 4)
        out += text(x + w / 2, y + h * 0.65, nm, size, t['accent'] if on else t['muted'], 500, 'middle')
        x += w + 2
    return out, x


# ---------- charts ----------
def smooth(points):
    """a smooth path through the points (catmull-rom as cubic beziers)"""
    d = 'M%g,%g' % points[0]
    for i in range(len(points) - 1):
        p0, p1 = points[max(i - 1, 0)], points[i]
        p2, p3 = points[i + 1], points[min(i + 2, len(points) - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += ' C%g,%g %g,%g %g,%g' % (c1 + c2 + p2)
    return d


def wave(seed, n, x0, x1, mid, amp):
    """the shape of a line on a chart - deterministic, and deliberately not anybody's prices"""
    pts = []
    for i in range(n):
        k = i / (n - 1)
        v = (math.sin(k * 5.1 + seed * 1.7) * 0.55 + math.sin(k * 11.3 + seed * 2.9) * 0.25
             + (k - 0.1) * math.sin(seed * 3.3) * 0.9)
        pts.append((x0 + k * (x1 - x0), mid - v * amp * min(1, k * 6)))
    return pts


# ---------- marking up a mockup ----------
def callout(x, y, n, color=CALLOUT, bg='#0d1117'):
    """a numbered badge; the slide's `.facts .k .n` carries the same number"""
    return ("<circle cx='%g' cy='%g' r='15' fill='%s'/>" % (x, y, color)
            + text(x, y + 6, str(n), 17, bg, 800, 'middle'))


def ring(x, y, w, h, color=CALLOUT):
    """a dashed frame around the part of the screen a callout is about"""
    return rect(x, y, w, h, 'none', color, 8, "stroke-width='2.5' stroke-dasharray='6 4'")


def marked(x, y, w, h, n, at='l', color=CALLOUT):
    """ring + its number, sitting on the ring's border at `at`: 'l' 'r' (middle of a side),
    't' 'b' (middle of top or bottom), 'tl' 'tr'. Pick the side that has empty space - a
    badge in a corner covers the first label of what it marks, and nobody sees it until
    preview shows it"""
    spots = {'l': (x, y + h / 2), 'r': (x + w, y + h / 2), 't': (x + w / 2, y),
             'b': (x + w / 2, y + h), 'tl': (x, y), 'tr': (x + w, y)}
    cx, cy = spots[at]
    return ring(x, y, w, h, color) + callout(max(cx, 16), max(cy, 16), n, color)


def svg(w, h, body, t=DARK, frame=True):
    """the whole picture. `frame` draws the app's background and border"""
    back = rect(0, 0, w, h, t['bg'], t['line'], 10) if frame else ''
    return ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 %d %d' width='%d' height='%d' %s>%s%s</svg>"
            % (w, h, w, h, FONT, back, body))


# ---------- looking at them ----------
def preview(folder):
    """screens/*.svg -> .preview/*.png in the deck folder. Headless and closed again, like
    deck_check's fit: it never touches the reader's window. Refuses an svg that does not parse,
    because a browser shows a broken one as an empty box and the slide looks merely sparse."""
    shots = sorted((Path(folder) / 'screens').glob('*.svg'))
    if not shots:
        raise SystemExit('no screens/*.svg in %s' % folder)
    bad = []
    for f in shots:
        try:
            xml.dom.minidom.parse(str(f))
        except Exception as e:                       # noqa: BLE001 - report every one
            bad.append('%s: %s' % (f.name, e))
    if bad:
        raise SystemExit('svg that does not parse:\n  ' + '\n  '.join(bad))
    from playwright.sync_api import sync_playwright
    out = Path(folder) / '.preview'
    out.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={'width': 1400, 'height': 900})
        for f in shots:
            # inline, not by url: a file:// image inside about:blank is blocked and comes
            # back as a broken-image icon that still "screenshots" fine
            page.set_content("<body style='margin:0'>%s</body>" % f.read_text(encoding='utf-8'))
            page.locator('svg').first.screenshot(path=str(out / (f.stem + '.png')))
            print('   %s' % (out / (f.stem + '.png')))
        b.close()
    print('%d screen(s) previewed - read the pngs, then fix and rerun' % len(shots))


def main():
    ap = argparse.ArgumentParser(description='drawn mockups of app screens')
    sub = ap.add_subparsers(dest='cmd', required=True)
    pv = sub.add_parser('preview', help='render screens/*.svg to .preview/*.png')
    pv.add_argument('folder')
    args = ap.parse_args()
    if args.cmd == 'preview':
        preview(args.folder)


if __name__ == '__main__':
    main()
