# -*- coding: utf-8 -*-
"""Draw boxes and arrows over a slide picture, list them, or clear them.

The reader draws in the browser (click a picture, full screen, pick a tool). This is the
same thing from the command line, so a session can point at part of a screenshot:

    python deck_draw.py <deck.html> list
    python deck_draw.py <deck.html> box   --slide 03 [--pic 1] --at 10,20,30,15 [--label "..."] [--mark]
    python deck_draw.py <deck.html> arrow --slide 03 [--pic 1] --at 60,80,42,35 [--label "..."] [--mark]
    python deck_draw.py <deck.html> clear [--slide 03]

--at is in percent of the picture, from its top-left corner:
    box    x,y,width,height
    arrow  from-x,from-y,to-x,to-y     (the label sits at the "from" end)
--pic counts the pictures on the slide from 1, in the order `list` prints them.
--mark flags the picture green (`updated`), so a reader who already has the deck finds the
drawing in the walk of changes. Then add its changes.json entry (references/the-reader.md).

The markup is the one draw.js writes -- shape_markup() here and shapeMarkup() there are
the same geometry, and tests/drawings_test.py holds them to it. The picture's shape comes
from the image file itself; a picture whose size cannot be read is refused, not guessed.
"""
import argparse
import html as htmlmod
import io
import math
import os
import re
import sys
from html.parser import HTMLParser

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

COLOR = '#E5484D'
WIDTH = 1000
WRAP_OPEN = '<span class="drawn-on">'
WRAP_MARKED = '<span class="drawn-on updated">'
SVG_AFTER = re.compile(r'\s*<svg class="drawings"[^>]*>(.*?)</svg>\s*</span>', re.S)
SVG_OPEN = '<svg class="drawings" viewBox="0 0 %d %d" aria-hidden="true">'


def r1(v):
    """Math.round(v * 10) / 10, printed the way JavaScript prints a number."""
    v = math.floor(v * 10 + 0.5) / 10
    if v == 0:
        return '0'
    s = '%.1f' % v
    return s[:-2] if s.endswith('.0') else s


def shape_markup(kind, a, b, label, rtl, height):
    """Inner markup of one <g class="dw">. a, b: (x, y) in viewBox units; height: the
    viewBox height. Sized on the picture's longer side, as draw.js does."""
    longer = max(WIDTH, height)
    sw, fs, out = longer / 200.0, longer / 40.0, []

    def attrs(pairs):
        return ' '.join('%s="%s"' % (k, v) for k, v in pairs)
    if kind == 'box':
        x, y = min(a[0], b[0]), min(a[1], b[1])
        w, h = abs(b[0] - a[0]), abs(b[1] - a[1])
        out.append('<rect %s></rect>' % attrs([('x', r1(x)), ('y', r1(y)), ('width', r1(w)),
            ('height', r1(h)), ('rx', r1(sw)), ('fill', 'none'), ('stroke', COLOR),
            ('stroke-width', r1(sw))]))
        anchor = 'end' if rtl else 'start'
        tx = x + w if rtl else x
        room = y - fs * 0.4 > fs
        ty = y - fs * 0.4 if room else y + fs + sw
        if not room:
            tx += -sw * 2 if rtl else sw * 2
    else:
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.sqrt(dx * dx + dy * dy) or 1
        ux, uy, head, half = dx / ln, dy / ln, sw * 4.5, sw * 2.6
        bx, by = b[0] - ux * head, b[1] - uy * head
        out.append('<line %s></line>' % attrs([('x1', r1(a[0])), ('y1', r1(a[1])),
            ('x2', r1(b[0] - ux * head * 0.6)), ('y2', r1(b[1] - uy * head * 0.6)),
            ('stroke', COLOR), ('stroke-width', r1(sw)), ('stroke-linecap', 'round')]))
        pts = [r1(b[0]), r1(b[1]), r1(bx - uy * half), r1(by + ux * half),
               r1(bx + uy * half), r1(by - ux * half)]
        out.append('<polygon %s></polygon>' % attrs([('points', ' '.join(pts)), ('fill', COLOR)]))
        anchor = 'end' if ux > 0.3 else 'start' if ux < -0.3 else 'middle'
        tx = a[0] - ux * fs * 0.5
        ty = a[1] - uy * fs * 0.9 + fs * 0.35
    if label:
        out.append('<text %s>%s</text>' % (attrs([('x', r1(tx)), ('y', r1(ty)),
            ('text-anchor', anchor), ('font-size', r1(fs)), ('font-weight', '700'),
            ('fill', COLOR), ('stroke', '#fff'), ('stroke-width', r1(fs * 0.18)),
            ('stroke-linejoin', 'round'), ('paint-order', 'stroke')]),
            htmlmod.escape(label, quote=False)))
    return ''.join(out)


def group(kind, a, b, label, rtl, height):
    return '<g class="dw" data-kind="%s">%s</g>' % (kind, shape_markup(kind, a, b, label, rtl, height))


# ---------- the picture's shape, read from the file ----------
def picture_size(path):
    """(width, height) of an image file. svg: width/height, else the viewBox."""
    if not os.path.isfile(path):
        raise SystemExit('picture not found: %s' % path)
    if path.lower().endswith('.svg'):
        head = io.open(path, encoding='utf-8').read(4000)
        tag = re.search(r'<svg\b[^>]*>', head, re.S)
        if not tag:
            raise SystemExit('no <svg> tag in %s' % path)
        t = tag.group(0)
        w = re.search(r"""\swidth=["']([\d.]+)(px)?["']""", t)
        h = re.search(r"""\sheight=["']([\d.]+)(px)?["']""", t)
        if w and h:
            return float(w.group(1)), float(h.group(1))
        vb = re.search(r"""viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)""", t)
        if vb:
            return float(vb.group(1)), float(vb.group(2))
        raise SystemExit('%s has neither width/height nor a viewBox: its shape is unknown' % path)
    try:
        from PIL import Image
    except ImportError:
        raise SystemExit('reading the size of %s needs pillow (pip install pillow)' % path)
    with Image.open(path) as im:
        return float(im.width), float(im.height)


# ---------- where the pictures are ----------
class Pictures(HTMLParser):
    """Every <img> inside a <section class="slide">, with its offset in the source."""
    def __init__(self, text):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.lines = [0]
        for line in text.splitlines(True):
            self.lines.append(self.lines[-1] + len(line))
        self.slide, self.depth, self.found, self.rtl = None, 0, [], False
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('html', 'body') and a.get('dir') == 'rtl':
            self.rtl = True
        if tag == 'section' and 'slide' in (a.get('class') or '').split():
            self.slide, self.depth = a.get('data-no') or '??', 0
        if self.slide and tag == 'section':
            self.depth += 1
        if self.slide and tag == 'img':
            line, col = self.getpos()
            start = self.lines[line - 1] + col
            self.found.append({'slide': self.slide, 'src': a.get('src') or '',
                               'start': start, 'end': start + len(self.get_starttag_text())})

    def handle_endtag(self, tag):
        if self.slide and tag == 'section':
            self.depth -= 1
            if self.depth == 0:
                self.slide = None


def pictures(text):
    p = Pictures(text)
    for i, pic in enumerate(p.found):
        same = [q for q in p.found[:i + 1] if q['slide'] == pic['slide']]
        pic['n'] = len(same)
        before = text[:pic['start']]
        pic['marked'] = before.endswith(WRAP_MARKED)
        pic['wrapped'] = pic['marked'] or before.endswith(WRAP_OPEN)
        pic['wrap_len'] = len(WRAP_MARKED if pic['marked'] else WRAP_OPEN) if pic['wrapped'] else 0
        m = SVG_AFTER.match(text, pic['end']) if pic['wrapped'] else None
        pic['svg'] = m
        pic['drawings'] = len(re.findall(r'<g class="dw"', m.group(1))) if m else 0
        pic['labels'] = [htmlmod.unescape(t) for t in re.findall(r'<text[^>]*>(.*?)</text>', m.group(1))] if m else []
    return p.found, p.rtl


def pick(found, slide, n):
    want = slide.lstrip('0') or '0'
    hit = [p for p in found if (p['slide'].lstrip('0') or '0') == want]
    if not hit:
        raise SystemExit('slide %s has no picture (list shows which slides do)' % slide)
    if not 1 <= n <= len(hit):
        raise SystemExit('slide %s has %d picture(s); --pic %d does not exist' % (slide, len(hit), n))
    return hit[n - 1]


def numbers(s, count):
    try:
        v = [float(x) for x in s.split(',')]
    except ValueError:
        v = []
    if len(v) != count or any(x < 0 or x > 100 for x in v):
        raise SystemExit('--at needs %d numbers between 0 and 100, comma-separated: got "%s"' % (count, s))
    return v


def add(text, deck, a):
    found, rtl = pictures(text)
    pic = pick(found, a.slide, a.pic)
    w, h = picture_size(os.path.join(os.path.dirname(os.path.abspath(deck)), pic['src']))
    vh = int(math.floor(WIDTH * h / w + 0.5))
    v = numbers(a.at, 4)
    if a.kind == 'box':
        p, q = (v[0], v[1]), (v[0] + v[2], v[1] + v[3])
        if q[0] > 100 or q[1] > 100:
            raise SystemExit('the box runs past the picture: x+width and y+height must stay within 100')
    else:
        p, q = (v[0], v[1]), (v[2], v[3])
    pa = (p[0] * WIDTH / 100.0, p[1] * vh / 100.0)
    pb = (q[0] * WIDTH / 100.0, q[1] * vh / 100.0)
    g = group(a.kind, pa, pb, a.label or '', rtl, vh)
    if pic['svg']:
        at = pic['svg'].start(1) + len(pic['svg'].group(1))
        text = text[:at] + g + text[at:]
        if a.mark and not pic['marked']:
            text = text[:pic['start'] - pic['wrap_len']] + WRAP_MARKED + text[pic['start']:]
        return text
    img = text[pic['start']:pic['end']]
    return (text[:pic['start']] + (WRAP_MARKED if a.mark else WRAP_OPEN) + img
            + (SVG_OPEN % (WIDTH, vh)) + g + '</svg></span>' + text[pic['end']:])


def clear(text, slide):
    found, _ = pictures(text)
    gone = 0
    for pic in reversed(found):        # from the end, so earlier offsets stay right
        if not pic['svg'] or (slide and (pic['slide'].lstrip('0') != slide.lstrip('0'))):
            continue
        gone += pic['drawings']
        img = text[pic['start']:pic['end']]
        text = text[:pic['start'] - pic['wrap_len']] + img + text[pic['svg'].end():]
    return text, gone


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('deck')
    ap.add_argument('kind', choices=['list', 'box', 'arrow', 'clear'])
    ap.add_argument('--slide')
    ap.add_argument('--pic', type=int, default=1)
    ap.add_argument('--at')
    ap.add_argument('--label')
    ap.add_argument('--mark', action='store_true', help='flag the picture green as a change')
    a = ap.parse_args()
    text = io.open(a.deck, encoding='utf-8', newline='').read()
    if a.kind == 'list':
        found, _ = pictures(text)
        if not found:
            print('no pictures on any slide')
        for p in found:
            print('slide %s  pic %d  %-36s %d drawing(s)%s%s' % (p['slide'], p['n'], p['src'],
                  p['drawings'], '  marked' if p['marked'] else '',
                  ('  labels: ' + ' | '.join(p['labels'])) if p['labels'] else ''))
        return
    if a.kind == 'clear':
        marks_removed = sum(1 for p in pictures(text)[0] if p['marked']
                       and (not a.slide or p['slide'].lstrip('0') == a.slide.lstrip('0')))
        out, gone = clear(text, a.slide)
        if not gone:
            raise SystemExit('nothing to clear%s' % (' on slide ' + a.slide if a.slide else ''))
    else:
        if not a.slide or not a.at:
            raise SystemExit('%s needs --slide and --at' % a.kind)
        out = add(text, a.deck, a)
        gone = None
    io.open(a.deck, 'w', encoding='utf-8', newline='').write(out)
    if gone is None:
        print('%s added on slide %s, picture %d%s%s' % (a.kind, a.slide, a.pic,
              ' -- "%s"' % a.label if a.label else '', ', marked green' if a.mark else ''))
        if a.mark:
            print('now add its entry to changes.json, in slide order (references/the-reader.md)')
        else:
            print('not marked: if the reader already has this deck, they will not find it in the '
                  'walk of changes -- ask them whether to mark; to mark, run again with --mark')
    else:
        print('cleared %d drawing(s)%s' % (gone, ' on slide ' + a.slide if a.slide else ''))
        if marks_removed:
            print('%d green mark(s) went with them -- take their entries out of changes.json, '
                  "or the reader's bar drops the whole record as mismatched" % marks_removed)


if __name__ == '__main__':
    main()
