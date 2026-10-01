#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Start a deck: the folder, the brief, the skeleton, the data builder.

A deck is not a file, it is a folder, and the folder is what makes the next round cheap:

    <folder>/
      brief.md              who reads it, what it is for, and one row per slide naming
                            where that slide's content comes from. Agreed before any
                            slide is written; `deck_check.py` enforces it afterwards
      <deck>.html           the slides. One <section class="slide"> each
      build_slide_data.py   reads the source named in the brief, writes data.json and
                            fragments/ - so no number in the deck was typed by a person
      data.json             what the builder produced
      fragments/            generated blocks the slides include
      changes.json          the reader's remarks, paired with the marks in the deck
      .bak/                 what the editor saved over, newest last

`--direction` has no default **on purpose**. Right-to-left is not a detail a session may
assume: it decides the sidebar's side, how mixed numbers must be wrapped, and whether the
pptx needs `rtl="1"` on every paragraph. Ask the reader, then pass what they said.

Usage
    python deck_new.py <folder> --title "..." --direction rtl --language he
    python deck_new.py <folder> --title "..." --direction ltr --language en --file deck.html
"""
import argparse
import json
import re
import sys
from pathlib import Path

# A Windows console is cp1252, and a deck title is not: without this the script dies while
# printing the slide it just wrote. Decks are Hebrew, Arabic, Greek more often than not.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


HERE = Path(__file__).resolve().parent
TEMPLATES = HERE.parent / 'templates'

HEBREW_FONT = ('<link href="https://fonts.googleapis.com/css2?'
               'family=Noto+Sans+Hebrew:wght@400;600;700;800&display=swap" rel="stylesheet">')

# The editing bar is the reader's, so it speaks the reader's language.
WORDS = {
    'he': {'changes': 'שינויים', 'notes': 'הערות', 'list': 'מה שיניתי',
           'save': 'שמור', 'undo': 'בטל שינויים', 'cover': 'שער', 'slides': 'שקפים',
           'contents': 'תוכן דברים'},
    'en': {'changes': 'changes', 'notes': 'remarks', 'list': 'what I changed',
           'save': 'save', 'undo': 'discard', 'cover': 'cover', 'slides': 'slides',
           'contents': 'contents'},
}


def words_for(language):
    return WORDS.get(language, WORDS['en'])


def fill(text, pairs):
    for key, value in pairs.items():
        text = text.replace('__%s__' % key, value)
    left = re.findall(r'__([A-Z]+)__', text)
    if left:
        raise SystemExit('template placeholder left unfilled: %s' % ', '.join(sorted(set(left))))
    return text


def main():
    ap = argparse.ArgumentParser(description='start a deck folder')
    ap.add_argument('folder')
    ap.add_argument('--title', required=True)
    ap.add_argument('--direction', required=True, choices=['rtl', 'ltr'],
                    help='ASK THE READER - it is not inferable and it changes the markup')
    ap.add_argument('--language', default='he', help='the <html lang>, e.g. he, en')
    ap.add_argument('--file', default=None, help='the deck file name (default deck.html)')
    ap.add_argument('--subtitle', default='')
    ap.add_argument('--strip', default='')
    ap.add_argument('--foot', default='')
    ap.add_argument('--no-builder', action='store_true',
                    help='the deck is written from a document, not generated from data')
    args = ap.parse_args()

    folder = Path(args.folder)
    name = args.file or 'deck.html'
    deck = folder / name
    brief = folder / 'brief.md'
    if deck.exists() or brief.exists():
        raise SystemExit('%s already holds a deck - deck_new.py never overwrites' % folder)

    say = words_for(args.language)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'fragments').mkdir(exist_ok=True)

    deck.write_text(fill((TEMPLATES / 'deck.html').read_text(encoding='utf-8'), {
        'LANG': args.language,
        'DIR': args.direction,
        'TITLE': args.title,
        'FILE': name,
        'FONT': HEBREW_FONT if args.language == 'he' else '',
        'COVER': say['cover'],
        'SUB': args.subtitle,
        'STRIP': args.strip,
        'FOOT': args.foot,
        'CHANGES': say['changes'],
        'NOTES': say['notes'],
        'LIST': say['list'],
        'SAVE': say['save'],
        'UNDO': say['undo'],
    }), encoding='utf-8')

    (folder / 'brief.md').write_text(fill((TEMPLATES / 'brief.md').read_text(encoding='utf-8'), {
        'TITLE': args.title,
        'PURPOSE': '*(one sentence)*',
        'AUDIENCE': '*(who reads it, and what they already know)*',
        'MEDIUM': '*(on screen · printed to pdf · sent as pptx)*',
        'LANG': args.language,
        'DIR': args.direction,
        'SOURCE': '*(the file, table or document this deck is read from)*',
        'OUTOFSCOPE': '*(what it deliberately leaves out)*',
        'COVER': say['cover'],
    }), encoding='utf-8')

    (folder / 'changes.json').write_text('{}\n', encoding='utf-8')

    if not args.no_builder:
        (folder / 'build_slide_data.py').write_text(
            (TEMPLATES / 'build_slide_data.py').read_text(encoding='utf-8'), encoding='utf-8')

    print('folder  : %s' % folder)
    print('deck    : %s   (%s, %s)' % (deck.name, args.language, args.direction))
    print('brief   : brief.md   -- fill it and get it approved before writing a slide')
    if not args.no_builder:
        print('builder : build_slide_data.py   -- point SOURCE at what the brief names')
    print('')
    print('next    : serve.py %s 8899' % folder)
    print('          deck_nav.py %s --heading %s --contents-heading %s'
          % (deck, say['slides'], say['contents']))
    print('          deck_check.py %s --url http://127.0.0.1:8899' % folder)
    return 0


if __name__ == '__main__':
    sys.exit(main())
