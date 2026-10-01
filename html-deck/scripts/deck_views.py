# -*- coding: utf-8 -*-
"""Report and extract the view blocks of a deck -- what each screen LOOKS like.

    python deck_views.py <deck.html|deck-folder> [--slide 09] [--html] [--json]

A screen slide answers two separate questions. What the screen HOLDS is prose --
`.facts`, `.flds`, `.acts` -- and `deck_text.py` already dumps it. What the screen
LOOKS like lives in the `.mock` blocks, and prose is exactly the wrong shape for it:
a mockup is a table with five columns, or a tree four levels deep, or a form of
eight fields, and flattening that to text throws the structure away.

So this script reads the mockups as structures:

    (default)   one row per mock: its title, the kind of view it is, and its size
    --html      the mock's raw markup, so another session can rebuild it
    --json      the same as data

The kind is detected from the markup, never from the wording, so it cannot drift
from what the slide actually renders. `data-view` on the <section> and the visible
`.viewkind` line are the slide's OWN claim about itself; the report prints both
next to the detected kinds, and says `MISMATCH` when the claim names a kind no
mock on that slide carries.
"""
import io
import json
import os
import re
import sys
from html.parser import HTMLParser

# A Windows console is cp1252, and a deck title is not: without this the script dies while
# printing the slide it just wrote. Decks are Hebrew, Arabic, Greek more often than not.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


VOID = {'br', 'img', 'hr', 'meta', 'link', 'input', 'source', 'wbr', 'col', 'area'}

# A view kind is recognised by a class on an element inside the mock body.
# First match in this order wins, so a table inside a card reads as a table.
KINDS = [
    ('mini',   'table',     'טבלה'),
    ('grid',   'table',     'טבלה'),
    ('kpis',   'kpis',      'מוני מצב'),
    ('tree',   'tree',      'עץ'),
    ('form',   'form',      'טופס'),
    ('board',  'board',     'לוח'),
    ('col',    'board',     'לוח עמודות'),
    ('rail',   'rail',      'רצף מצבים'),
    ('pcard',  'cards',     'כרטיסים'),
    ('bcard',  'cards',     'כרטיסים'),
    ('cards',  'cards',     'כרטיסים'),
    ('who',    'people',    'אנשים'),
    ('two',    'two',       'שני צדדים'),
    ('rules',  'rules',     'כללים'),
    ('facts',  'fields',    'שדות'),
    ('chips',  'chips',     'סרגל'),
    ('note',   'note',      'הערה'),
]
KIND_OF = dict((c, k) for c, k, _ in KINDS)
LABEL_OF = dict((k, lab) for _, k, lab in KINDS)

# Kinds that ARE the view. `chips`, `fields` and `note` decorate one -- an action
# strip sits under nearly every mockup, so treating it as a view kind would report
# every screen as a סרגל and say nothing.
STRUCTURAL = {'table', 'kpis', 'tree', 'form', 'board', 'rail', 'cards',
              'people', 'two', 'rules'}

# Three screens draw their view straight onto the slide with no `.mock` frame
# around it -- a `.rail`, a `.two`, a `.rules`. Those are views too, and a report
# that only reads mocks would call those slides empty.
LOOSE = dict((c, k) for c, k, _ in KINDS if k in STRUCTURAL)


def line_offsets(src):
    offs, i = [0], 0
    for line in src.splitlines(True):
        i += len(line)
        offs.append(i)
    return offs


class Views(HTMLParser):
    """Walks a deck and records every `.mock`, with its span in the source."""

    def __init__(self, src, deck):
        super().__init__(convert_charrefs=True)
        self.src = src
        self.offs = line_offsets(src)
        self.deck = deck
        self.stack = []              # every open element: {tag, cls, mock}
        self.slides = []             # one dict per slide
        self.slide = None
        self.mock = None             # the mock being collected, if any
        self.skip = 0

    # -- source positions ---------------------------------------------------
    def at(self):
        ln, col = self.getpos()
        return self.offs[ln - 1] + col

    def line(self):
        return self.getpos()[0]

    def end_of_tag(self, start):
        j = self.src.find('>', start)
        return len(self.src) if j < 0 else j + 1

    # -- parser hooks -------------------------------------------------------
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
            return
        if self.skip or tag in VOID:
            return
        a = dict(attrs)
        cls = a.get('class', '').split()

        if tag == 'section' and 'slide' in cls:
            self.slide = {
                'deck': self.deck, 'no': a.get('data-no', '--'),
                'name': a.get('data-name', ''), 'line': self.line(),
                'view': a.get('data-view', ''), 'viewkind': '', 'pill': '',
                'mocks': [],
            }
            self.slides.append(self.slide)

        if self.slide is not None and 'viewkind' in cls:
            self.slide['_grab'] = len(self.stack)      # collect this element's text
        if self.slide is not None and '_grab' in self.slide:
            # the pill and the sentence are two separate claims; running them
            # together would report the kind twice and read as a typo
            if 'vk' in cls:
                self.slide['_take'] = 'pill'
            elif 'vt' in cls:
                self.slide['_take'] = 'viewkind'

        opened = False
        if self.slide is not None and self.mock is None:
            loose = [LOOSE[c] for c in cls if c in LOOSE]
            if 'mock' in cls or loose:
                self.mock = {
                    'line': self.line(), 'start': self.at(), 'end': None,
                    'title': '' if 'mock' in cls else LABEL_OF[loose[0]],
                    'cap': '', 'kinds': [], 'counts': {},
                    'framed': 'mock' in cls,
                }
                self.slide['mocks'].append(self.mock)
                opened = True

        if self.mock is not None:
            for c in cls:
                if c in KIND_OF and KIND_OF[c] not in self.mock['kinds']:
                    self.mock['kinds'].append(KIND_OF[c])
            n = self.mock['counts']
            for c in cls + [tag]:
                if c in ('tr', 'th', 'chip', 'fld', 'card', 'pcard', 'bcard', 'side', 'li',
                         'l1', 'l2', 'l3', 'l4', 'f', 'kpi', 'r', 'st', 'p'):
                    n[c] = n.get(c, 0) + 1
            if 'mt' in cls:
                self.mock['_take'] = 'title'
            elif 'cap' in cls:
                self.mock['_take'] = 'cap'

        self.stack.append({'tag': tag, 'cls': cls, 'block': opened})

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)
            return
        if self.skip or tag in VOID:
            return
        # unwind to the matching open element; malformed markup cannot desync us
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]['tag'] == tag:
                closed = self.stack[i]
                del self.stack[i:]
                break
        else:
            return
        if closed['block'] and self.mock is not None:
            self.mock['end'] = self.end_of_tag(self.at())
            self.mock.pop('_take', None)
            self.mock = None
        if self.slide is not None and self.slide.get('_grab') == len(self.stack):
            self.slide.pop('_grab', None)

    def handle_data(self, data):
        if self.skip:
            return
        text = re.sub(r'\s+', ' ', data).strip()
        if not text:
            return
        if self.mock is not None and self.mock.get('_take'):
            key = self.mock.pop('_take')
            self.mock[key] = (self.mock[key] + ' ' + text).strip()
        elif self.slide is not None and '_grab' in self.slide:
            key = self.slide.pop('_take', 'viewkind')
            self.slide[key] = (self.slide.get(key, '') + ' ' + text).strip()


def split_kinds(m):
    """(the kind this block IS, the kinds that decorate it)."""
    main = [k for k in m['kinds'] if k in STRUCTURAL]
    extra = [k for k in m['kinds'] if k not in STRUCTURAL]
    if main:
        return main[0], main[1:] + extra
    # a filter strip or a facts box is a view too -- it is just not a
    # structure, so it never gets to speak for the whole slide
    return (extra[0] if extra else ''), extra[1:]


def size(m):
    """A one-phrase measurement of the mock, in the terms of its own kind."""
    n = m['counts']
    out = []
    if 'table' in m['kinds']:
        rows = n.get('tr', 0)
        out.append('%d עמודות · %d שורות' % (n.get('th', 0), max(0, rows - 1)))
    for key, word in (('side', 'צדדים'), ('fld', 'שדות'), ('kpi', 'מונים'), ('card', 'כרטיסים'),
                      ('pcard', 'כרטיסים'), ('bcard', 'כרטיסים'), ('f', 'שדות'),
                      ('r', 'כללים'), ('st', 'מצבים'), ('p', 'אנשים')):
        if n.get(key):
            out.append('%d %s' % (n[key], word))
    depth = [k for k in ('l1', 'l2', 'l3', 'l4') if n.get(k)]
    if depth:
        out.append('%d רמות · %d שורות' % (len(depth), sum(n[k] for k in depth)))
    if n.get('side') and n.get('li'):
        out.append('%d שורות' % n['li'])
    if n.get('chip'):
        out.append('%d פעולות' % n['chip'])
    return ' · '.join(out)


def read(path):
    return io.open(path, encoding='utf-8').read()


def decks(target):
    if os.path.isdir(target):
        return [os.path.join(target, f) for f in sorted(os.listdir(target))
                if f.endswith('.html')]
    return [target]


def collect(target, only=None):
    """Every slide worth reporting, each carrying the source it was read from --
    read once per file, not once per slide and again per output pass."""
    out = []
    for path in decks(target):
        src = read(path)
        p = Views(src, os.path.basename(path))
        p.feed(src)
        for s in p.slides:
            s.pop('_grab', None)
            s.pop('_take', None)
            if only and s['no'] != only:
                continue
            if s['mocks'] or s['view'] or s['viewkind']:
                out.append((path, s, src))
    return out


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2
    target = args[0]
    only = None
    want_html = '--html' in args
    want_json = '--json' in args
    if '--slide' in args:
        only = args[args.index('--slide') + 1]
    found = collect(target, only)

    if want_json:
        rows = []
        for path, s, src in found:
            for m in s['mocks']:
                p, extra = split_kinds(m)
                rows.append({
                    'deck': s['deck'], 'slide': s['no'], 'slide_name': s['name'],
                    'declared_view': s['view'], 'pill': s['pill'],
                    'viewkind': s['viewkind'],
                    'line': m['line'], 'title': m['title'], 'cap': m['cap'],
                    'view': p, 'also': extra, 'framed': m['framed'], 'size': size(m),
                    'html': src[m['start']:m['end']] if want_html else None,
                })
        print(json.dumps(rows, ensure_ascii=False, indent=1))
        return 0

    deck_now = None
    for path, s, src in found:
        if s['deck'] != deck_now:
            deck_now = s['deck']
            print('\n--- %s' % deck_now)
        detected = []
        for m in s['mocks']:
            p, _ = split_kinds(m)
            if p and p not in detected:
                detected.append(p)
        claim = s['view'] or '—'
        flag = ''
        # only a slide that frames a mockup is claiming to be a screen; a question
        # list or an appendix has a shape but not a view, and nagging it is noise
        framed = any(m['framed'] for m in s['mocks'])
        if not s['view']:
            flag = '   NO data-view' if framed else ''
        elif s['view'] not in detected:
            flag = '   MISMATCH: nothing on this slide is a %s (found %s)' % (
                s['view'], '+'.join(detected) or 'nothing')
        print('\n=== %s  %s   [%s]%s' % (s['no'], s['name'], claim, flag))
        if s['viewkind'] or framed:
            print('    %s%s' % ('[%s] ' % s['pill'] if s['pill'] else '',
                                s['viewkind'] or 'NO viewkind line'))
        for m in s['mocks']:
            p, extra = split_kinds(m)
            kinds = LABEL_OF.get(p, p) or '?'
            if extra:
                kinds += ' (+%s)' % '+'.join(LABEL_OF.get(k, k) for k in extra)
            frame = ' ' if m['framed'] else '~'      # ~ = drawn on the slide, no mock frame
            print(' %s%5d  %-22s %-22s %s' % (frame, m['line'], m['title'][:22],
                                              kinds, size(m)))
            if m['cap']:
                print('         %s' % m['cap'])
            if want_html:
                print(src[m['start']:m['end']])
                print()
    n = sum(len(s['mocks']) for _, s, _src in found)
    print('\n%d slides, %d view blocks' % (len(found), n))
    return 0


if __name__ == '__main__':
    sys.exit(main())
