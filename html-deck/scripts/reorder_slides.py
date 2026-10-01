#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Put the slides in the order written in `slide-order.txt`, by title.

Reordering by hand means cutting and pasting 40-line blocks of HTML and then fixing every
number and every index link. This moves whole `<section>` blocks, and refuses to write unless
the order file and the deck describe exactly the same set of slides — a title that matches
nothing, or two slides, stops the run before anything is touched.

The cover stays first, whatever the file says.

After it runs, two commands finish the job:
    python <skill>/scripts/deck_edit.py <deck> --ops - --renumber   stamps data-no and badges
    python <skill>/scripts/deck_nav.py <deck-folder>                relinks sidebar + contents

Usage:
    python reorder_slides.py <deck.html>           # uses slide-order.txt beside the deck
    python reorder_slides.py <deck.html> --order other.txt
    python reorder_slides.py <deck.html> --list                # show the order it would write
"""
import argparse
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SECTION = re.compile(r'<section class="slide.*?</section>\n', re.S)
TITLE = re.compile(r'<h1[^>]*>(.*?)</h1>', re.S)


def flat(text):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', text or '')).strip()


def slides_of(html):
    out = []
    for m in SECTION.finditer(html):
        block = m.group(0)
        title = TITLE.search(block)
        name = re.search(r'data-name="([^"]*)"', block)
        out.append({
            'block': block,
            'title': flat(title.group(1)) if title else '',
            'name': name.group(1) if name else '',
            'cover': 'class="slide cover"' in block,
        })
    return out


def pick(slides, wanted, used):
    exact = [s for s in slides if s['title'] == wanted and id(s) not in used]
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        raise SystemExit('“%s” matches %d slides by title — make the titles distinct' % (wanted, len(exact)))
    loose = [s for s in slides
             if id(s) not in used and (s['title'].startswith(wanted) or s['name'] == wanted
                                       or wanted in s['title'])]
    if len(loose) == 1:
        return loose[0]
    if not loose:
        raise SystemExit('“%s” matches no slide in the deck' % wanted)
    raise SystemExit('“%s” matches %d slides (%s) — write the title in full'
                     % (wanted, len(loose), ' | '.join(s['title'] for s in loose)))


def main():
    ap = argparse.ArgumentParser(description='reorder the slides of a deck')
    ap.add_argument('deck', help='the deck .html to reorder')
    ap.add_argument('--order', default=None,
                    help='the order file (default slide-order.txt beside the deck)')
    ap.add_argument('--list', action='store_true', help='report only, write nothing')
    args = ap.parse_args()

    deck = Path(args.deck)
    order = Path(args.order) if args.order else deck.parent / 'slide-order.txt'
    html = deck.read_text(encoding='utf-8')
    slides = slides_of(html)
    wanted = [line.strip() for line in order.read_text(encoding='utf-8').splitlines()
              if line.strip() and not line.startswith('#')]

    cover = [s for s in slides if s['cover']]
    rest = [s for s in slides if not s['cover']]
    if len(wanted) != len(rest):
        raise SystemExit('the order file lists %d slides and the deck has %d (the cover aside):\n  %s'
                         % (len(wanted), len(rest), '\n  '.join(s['title'] for s in rest)))

    used, ordered = set(), []
    for title in wanted:
        chosen = pick(rest, title, used)
        used.add(id(chosen))
        ordered.append(chosen)

    for i, slide in enumerate(cover + ordered, start=1):
        print('  %02d  %s' % (i, slide['title'] or slide['name']))
    if args.list:
        print('(--list: nothing written)')
        return

    head = html[:html.index('<section class="slide')]
    tail = html[html.rindex('</section>\n') + len('</section>\n'):]
    deck.write_text(head + ''.join(s['block'] for s in cover + ordered) + tail, encoding='utf-8')
    print('written: %s' % deck)
    print('next   : deck_edit.py --renumber, then deck_nav.py')


if __name__ == '__main__':
    sys.exit(main())
