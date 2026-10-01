#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Read the source named in brief.md, and write what the slides draw from.

This is the one place the deck meets the data. It writes two things beside itself:

    data.json       every number and name the deck shows, in one document
    fragments/*.html  the html of the blocks that are generated rather than written

A slide then either holds written prose, or holds a fragment. Nothing in the deck is a
number somebody typed: when the source changes, this runs again and the deck is current.

Keep each extraction in its own small function named for what it returns, so the slide and
the function that fed it can be read side by side.

Usage
    python build_slide_data.py                 # read the source, write data.json + fragments
    python build_slide_data.py --list          # say what it found, write nothing
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRAGMENTS = HERE / 'fragments'

# The source, as brief.md names it. One constant, so the deck's provenance is one line of
# code and not a path buried in three functions.
SOURCE = HERE / '..' / 'CHANGE-ME'


def esc(text):
    return (str(text).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def read_source():
    """Everything this deck draws from, loaded once."""
    raise SystemExit('build_slide_data.py: SOURCE is not set yet - see brief.md')


def example_of(raw):
    """One extraction per slide block. Named for what it returns, not for its slide number:
    slides get reordered and a function called `slide_07` then lies."""
    return []


def table_html(rows, headings):
    out = ['<table class="grid">', '<tr>%s</tr>'
           % ''.join('<th>%s</th>' % esc(h) for h in headings)]
    for row in rows:
        out.append('<tr>%s</tr>' % ''.join('<td>%s</td>' % esc(c) for c in row))
    out.append('</table>')
    return '\n'.join(out)


def main():
    ap = argparse.ArgumentParser(description='build the deck data from its source')
    ap.add_argument('--list', action='store_true', help='report only, write nothing')
    args = ap.parse_args()

    raw = read_source()
    data = {'example': example_of(raw)}

    for key, value in data.items():
        print('%-14s %d' % (key, len(value)))
    if args.list:
        print('(--list: nothing written)')
        return 0

    (HERE / 'data.json').write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    FRAGMENTS.mkdir(exist_ok=True)
    (FRAGMENTS / 'example.html').write_text(
        table_html(data['example'], ['a', 'b']), encoding='utf-8')
    print('written: data.json and %d fragment(s)' % 1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
