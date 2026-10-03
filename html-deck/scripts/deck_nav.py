#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Build the deck's navigation - the side list of slides, and the contents block.

Both are written from **one** scan of the deck's own `<section>` elements, so they cannot
disagree with each other or with the deck. Neither is ever written by hand: a contents list
goes stale the moment a slide is added, renamed or reordered, and a stale one is worse than
none - the reader clicks 7 and lands on 8.

Deterministic, and that is the point:
  * the scan is the only input - same file in, same bytes out
  * both blocks sit between markers (`<!-- slidebar:start -->` ... `end`), so a rerun
    replaces exactly what the last run wrote and touches nothing a person put there
  * running it twice changes nothing the second time; `--check` says so without writing

What it writes
  sidebar   `<nav id="slidebar">` right after the opening `<body>` - one link per slide.
            Screen furniture: `deck.css` hides it in print and both pptx exports drop it.
            `nav.js` marks the slide you are on and tells `fit.js` how much width it took.
  contents  a `.toc` block on the cover, or on the slide named by `--contents-on`.

Usage
    python deck_nav.py <deck.html|deck-folder>
    python deck_nav.py <deck> --check              # exit 1 if a rerun would change anything
    python deck_nav.py <deck> --list               # print the slides, write nothing
    python deck_nav.py <deck> --no-contents        # sidebar only
    python deck_nav.py <deck> --contents-on NAME   # the slide the contents go on
    python deck_nav.py <deck> --heading Slides     # the sidebar's own heading
"""
import argparse
import re
import sys
from pathlib import Path

# A Windows console is cp1252, and a deck title is not: without this the script dies while
# printing the slide it just wrote. Decks are Hebrew, Arabic, Greek more often than not.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


SECTION = re.compile(r'<section class="slide([^"]*)"([^>]*)>(.*?)</section>', re.S)
TITLE = re.compile(r'<h1 class="title">(.*?)</h1>|<h1>(.*?)</h1>', re.S)
BODY = r'<body[^>]*>'
MARK = '<!-- %s:start -->'
ENDMARK = '<!-- %s:end -->'
# A deck written before the markers existed keeps its block's place instead of gaining a
# second copy beside it: the first run adopts what is there, every run after replaces it.
ADOPT_SIDEBAR = r'<nav id="slidebar".*?</nav>\n?'
# The sidebar is markup plus one script. A deck that predates the script gets it here, and
# it goes **before** fit.js: nav.js publishes the width it took, and fit.js scales the slides
# against the room that is left. The other way round the first fit is computed for the whole
# window and the slides sit under the panel until the first resize.
NAV_SCRIPT = '<script src="/_deck/nav.js"></script>'
FIT_SCRIPT = '<script src="/_deck/fit.js"></script>'
ADOPT_CONTENTS = r'[ \t]*<div class="toc">.*?\n[ \t]*</div>\n?'
# The headings are the deck's own words. Once written they are read back from the deck, so
# a rerun - and deck_check, which passes no headings - keeps what is there instead of
# swapping an English deck's "slides" for the Hebrew default and calling the deck stale.
# Only a deck that has none yet takes them from its <html lang>.
HEADINGS = {'he': ('שקפים', 'תוכן דברים'), 'en': ('slides', 'contents')}


def headings(html, args):
    lang = re.search(r'<html[^>]*\blang="([a-z]+)', html)
    lang = lang.group(1) if lang and lang.group(1) in HEADINGS else 'en'
    side = re.search(r'<div class="sb-h">(.*?)</div>', html, re.S)
    toc = re.search(r'<div class="toc-h">(.*?)</div>', html, re.S)
    return (args.heading or (side.group(1) if side else HEADINGS[lang][0]),
            args.contents_heading or (toc.group(1) if toc else HEADINGS[lang][1]))


def attr(text, name):
    m = re.search(r'%s="([^"]*)"' % name, text)
    return m.group(1) if m else None


def flat(text):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', text or '')).strip()


def slides_of(html):
    out = []
    for m in SECTION.finditer(html):
        classes, attrs, body = m.group(1), m.group(2), m.group(3)
        title = TITLE.search(body)
        text = (title.group(1) or title.group(2)) if title else (attr(attrs, 'data-name') or '')
        out.append({
            'no': attr(attrs, 'data-no') or '',
            'name': attr(attrs, 'data-name') or '',
            'title': flat(text),
            'cover': 'cover' in classes.split(),
            'start': m.start(),
            'end': m.end(),
        })
    return out


def with_ids(html, slides):
    """Give every slide exactly one id, and say what each slide's id is.

    Three rules, each one learned from a way this broke in a real deck:
      * the id goes **after** the class attribute. `deck_edit.py --renumber` and this script
        both match a tag that starts `<section class="slide`, and an id in front of the class
        makes the section invisible to them: the badges renumber and `data-no` does not.
      * a section carries **one** id. A slide already styled by id (`#flow`) keeps that one
        and the contents links to it; adding `s04` beside it is invalid html.
      * an `sNN` id is **rewritten** from the current `data-no` every run. Reordering a deck
        otherwise leaves the old numbers behind and two slides end up sharing `s03`.
    """
    ids = {}
    # every opening tag is collected before anything is rewritten: editing the text while
    # walking it shifts the offsets of every slide after the one just changed
    openings = [html[s['start']:html.index('>', s['start']) + 1] for s in slides]
    for slide, opening in zip(slides, openings):
        named = [i for i in re.findall(r'\bid="([^"]+)"', opening) if not re.fullmatch(r's\d+', i)]
        stripped = re.sub(r'\s+id="s\d+"', '', opening)
        if named:
            fixed, ids[slide['no']] = stripped, named[0]
        else:
            ids[slide['no']] = 's%s' % slide['no']
            fixed = re.sub(r'(<section class="slide[^"]*")', r'\1 id="s%s"' % slide['no'],
                           stripped, count=1)
        if fixed != opening:
            html = html.replace(opening, fixed, 1)
    return html, ids


def put(html, key, block, after=None, inside=None, adopt=None):
    """Write a marked block: replace the one between the markers, or place it the first time.

    `after` is a regex whose match the block follows. `inside` is a (start, end) span whose
    closing tag it goes before. `adopt` is a regex for the same block written before the
    markers existed - an older deck keeps its place instead of gaining a second copy.
    """
    start, end = MARK % key, ENDMARK % key
    whole = '%s\n%s\n%s\n' % (start, block, end)
    if start in html and end in html:
        a = html.index(start)
        after_end = html.index(end) + len(end)
        b = after_end + (1 if html[after_end:after_end + 1] == '\n' else 0)
        return html[:a] + whole + html[b:], 'rewritten'
    if adopt is not None:
        # a deck that had one of these blocks before the markers existed: take it over
        # rather than writing a second one beside it
        a, b = inside if inside else (0, len(html))
        m = re.search(adopt, html[a:b], re.S)
        if m:
            return html[:a + m.start()] + whole + html[a + m.end():], 'adopted'
    if after is not None:
        m = re.search(after, html)
        if not m:
            raise SystemExit('deck_nav: nothing matched %r - is this a deck?' % after)
        return html[:m.end()] + '\n' + whole + html[m.end():], 'written'
    a, b = inside
    body = html[a:b]
    at = body.rindex('</section>')
    return html[:a] + body[:at] + whole + body[at:] + html[b:], 'written'


def sidebar_block(slides, ids, heading):
    rows = ['    <li><a href="#%s"><span class="sb-n">%s</span>'
            '<span class="sb-t">%s</span></a></li>'
            % (ids[s['no']], s['no'], s['title'] or s['name'])
            for s in slides]
    return ('<nav id="slidebar" aria-label="%s">\n  <div class="sb-h">%s</div>\n'
            '  <ol class="sb-list">\n%s\n  </ol>\n</nav>'
            % (heading, heading, '\n'.join(rows)))


def contents_block(slides, ids, heading):
    """A contents list the way a printed document does it: the title, leader dots, then the
    number. It belongs on the cover, as a book has it - not on a slide of its own."""
    rows = ['      <a class="toc-row" href="#%s"><span class="t">%s</span>'
            '<span class="fill"></span><span class="n">%s</span></a>'
            % (ids[s['no']], s['title'] or s['name'], s['no'])
            for s in slides if not s['cover']]
    return ('  <div class="toc">\n    <div class="toc-h">%s</div>\n    <div class="toc-list">\n'
            '%s\n    </div>\n  </div>' % (heading, '\n'.join(rows)))


def decks_in(target):
    p = Path(target)
    return sorted(p.glob('*.html')) if p.is_dir() else [p]


def rebuild(html, args):
    slides = slides_of(html)
    if not slides:
        raise SystemExit('no slides found - a deck is <section class="slide">')
    html, ids = with_ids(html, slides)
    slides = slides_of(html)
    said = []
    side_heading, contents_heading = headings(html, args)

    if not args.no_sidebar:
        block = sidebar_block(slides, ids, side_heading)
        html, how = put(html, 'slidebar', block, after=BODY,
                        adopt=ADOPT_SIDEBAR)
        said.append('sidebar %s, %d slides' % (how, len(slides)))
        if NAV_SCRIPT not in html:
            if FIT_SCRIPT in html:
                html = html.replace(FIT_SCRIPT, NAV_SCRIPT + '\n' + FIT_SCRIPT, 1)
            elif '</body>' in html:
                html = html.replace('</body>', NAV_SCRIPT + '\n</body>', 1)
            else:
                raise SystemExit('deck_nav: no </body> to put nav.js before')
            said.append('nav.js added - the list marks where the reader is')

    if not args.no_contents:
        if args.contents_on:
            host = next((s for s in slides if args.contents_on in (s['name'], s['title'])), None)
            if host is None:
                raise SystemExit('no slide named %r for the contents' % args.contents_on)
        else:
            host = next((s for s in slides if s['cover']), None)
        if host is None:
            said.append('contents: no cover slide and no --contents-on, skipped')
        else:
            block = contents_block(slides, ids, contents_heading)
            # the host's span is read again from the current text: the sidebar moved it
            now = next(s for s in slides_of(html) if s['no'] == host['no'])
            html, how = put(html, 'contents', block, inside=(now['start'], now['end']),
                            adopt=ADOPT_CONTENTS)
            said.append('contents %s on slide %s' % (how, host['no']))
    return html, slides, said


def main():
    ap = argparse.ArgumentParser(description='build the slide sidebar and the contents block')
    ap.add_argument('deck', help='a deck .html, or a folder of them')
    ap.add_argument('--heading', default=None,
                    help="the heading over the sidebar (default: the deck's own, else by <html lang>)")
    ap.add_argument('--contents-heading', default=None,
                    help="the contents heading (default: the deck's own, else by <html lang>)")
    ap.add_argument('--contents-on', default=None, help='the slide the contents go on')
    ap.add_argument('--no-sidebar', action='store_true')
    ap.add_argument('--no-contents', action='store_true')
    ap.add_argument('--list', action='store_true', help='report only, write nothing')
    ap.add_argument('--check', action='store_true', help='exit 1 if a run would change the file')
    args = ap.parse_args()

    bad = 0
    for deck in decks_in(args.deck):
        was = deck.read_text(encoding='utf-8')
        html, slides, said = rebuild(was, args)
        print('%s: %d slides' % (deck.name, len(slides)))
        if args.list:
            for s in slides:
                print('   %s  %s' % (s['no'], s['title'] or s['name']))
            continue
        if args.check:
            if html != was:
                print('   STALE - the navigation does not match the slides; run deck_nav.py')
                bad = 1
            else:
                print('   navigation is in step with the slides')
            continue
        for line in said:
            print('   %s' % line)
        if html != was:
            deck.write_text(html, encoding='utf-8')
            print('   written: %s' % deck)
        else:
            print('   unchanged')
    return bad


if __name__ == '__main__':
    sys.exit(main())
