#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""The gate a deck passes before anyone outside the room sees it.

Five checks, each one a defect that actually shipped:

  fit     every slide fits the 1280x720 frame. A slide that overflows is **clipped** on
          screen by `overflow:hidden`, so it looks finished while its last rows are gone,
          and it reaches the pdf and the pptx the same way. Measured in a headless
          browser at zoom 1, because only a browser knows how tall Hebrew text wraps.
  nav     the sidebar and the contents match the slides -- `deck_nav.py --check`.
  marks   `data-no`, the corner badge and the ids agree, and no contents link is dead.
  brief   every slide has a row in `brief.md`, and every row names where its content
          came from. A slide whose source column is empty is a slide nobody may write.
  edit    every line of words on a slide can be clicked and rewritten by the reader.
          Read in the same headless browser, after edit.js armed the page. A deck whose
          lines edit.js never armed passed the other four and could not be edited at all.
          A line meant to stay fixed carries data-fixed.

Exit code is the result: 0 if every check passed, 1 otherwise. Nothing is written.

The fit and edit checks need the deck **served**, because the stylesheet lives at `/_deck/` and a
`file://` page has no styling to measure. Give it the base url of the running viewer.

Usage
    python deck_check.py <deck-folder> --url http://127.0.0.1:8899
    python deck_check.py <deck.html>  --url http://127.0.0.1:8899 --only fit
    python deck_check.py <deck-folder> --no-fit          # the three checks that need no browser
    python deck_check.py <deck-folder> --url ... --only edit
    python deck_check.py <deck-folder> --url ... --allow-grow
"""
import argparse
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import deck_nav                                        # noqa: E402  the one scan, shared

# A Windows console is cp1252, and a deck title is not: without this the script dies while
# printing the slide it just wrote. Decks are Hebrew, Arabic, Greek more often than not.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


FRAME_H = 720
FRAME_W = 1280
SLACK = 2                                              # sub-pixel rounding, not an overflow

MEASURE_JS = """
() => {
  document.querySelectorAll('.slide').forEach(s => { s.style.zoom = 1; });
  return [...document.querySelectorAll('section.slide')].map(s => ({
    no: s.dataset.no || '',
    name: s.dataset.name || '',
    grow: s.classList.contains('grow'),
    down: s.scrollHeight - s.clientHeight,
    across: s.scrollWidth - s.clientWidth,
    height: Math.round(s.getBoundingClientRect().height)
  }));
}
"""

# Every text node on a slide whose element edit.js did not arm. Same exclusions as FIXED in
# edit.js -- keep the two in step.
UNEDITABLE_JS = """
() => {
  const FIXED = '.slide-no, .toc, [data-fixed], [data-chrome], script, style, svg, button, .undo-btn';
  const out = [];
  document.querySelectorAll('section.slide').forEach(s => {
    const walk = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const words = n.nodeValue.trim();
      const el = n.parentElement;
      if (!words || el.closest(FIXED)) continue;
      const armed = el.closest('[data-edit]');
      if (armed && armed.isContentEditable) continue;
      out.push({no: s.dataset.no || '', name: s.dataset.name || '', words: words.slice(0, 60)});
    }
  });
  return {slides: document.querySelectorAll('section.slide').length,
          armed: document.querySelectorAll('section.slide [data-edit]').length, out};
}
"""


class Report(object):
    def __init__(self):
        self.failed = []

    def ok(self, what, detail=''):
        print('  PASS  %-6s %s' % (what, detail))

    def bad(self, what, detail):
        print('  FAIL  %-6s %s' % (what, detail))
        self.failed.append(what)


def check_nav(deck, html, rep):
    class Args(object):
        heading = None              # the deck's own headings - see deck_nav.headings
        contents_heading = None
        contents_on = None
        no_sidebar = False
        no_contents = False
    rebuilt, slides, _ = deck_nav.rebuild(html, Args())
    if rebuilt == html:
        rep.ok('nav', '%d slides, sidebar and contents in step' % len(slides))
    else:
        rep.bad('nav', 'the sidebar or the contents is out of step -- run deck_nav.py')
    return slides


def check_marks(html, slides, rep):
    trouble = []
    ids = re.findall(r'<section class="slide[^"]*"\s+id="([^"]+)"', html)
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        trouble.append('ids used twice: %s' % ', '.join(dupes))
    for i, s in enumerate(slides, start=1):
        want = '%02d' % i
        if s['no'] != want:
            trouble.append('slide %d carries data-no="%s"' % (i, s['no']))
        badge = re.search(r'<div class="slide-no">(.*?)</div>',
                          html[s['start']:s['end']], re.S)
        if badge and badge.group(1).strip() != s['no']:
            trouble.append('slide %s shows the badge %s' % (s['no'], badge.group(1).strip()))
    anchors = set(re.findall(r'href="#([^"]+)"', html))
    present = set(re.findall(r'\sid="([^"]+)"', html))
    dead = sorted(anchors - present)
    if dead:
        trouble.append('links to nothing: %s' % ', '.join(dead))
    if trouble:
        for line in trouble:
            rep.bad('marks', line)
    else:
        rep.ok('marks', '%d slides numbered, badged and linked' % len(slides))


def brief_rows(folder):
    """The slide plan out of `brief.md`: rows whose first cell is a slide number."""
    path = folder / 'brief.md'
    if not path.exists():
        return None, path
    rows = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        if not line.strip().startswith('|'):
            continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells) < 4 or not re.fullmatch(r'\d{1,2}', cells[0]):
            continue
        rows['%02d' % int(cells[0])] = {'title': cells[1], 'answers': cells[2],
                                        'source': cells[3],
                                        'picture': cells[4] if len(cells) > 4 else None}
    return rows, path


def screens_answer(path):
    """The brief's 'shows the app's screens' line: 'yes', 'no', 'unsaid', or None when it has none."""
    for line in path.read_text(encoding='utf-8').splitlines():
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells) == 2 and cells[0].lower().startswith('shows the app'):
            said = cells[1].strip('* ').lower()
            return 'yes' if said.startswith('yes') else 'no' if said.startswith('no') else 'unsaid'
    return None


def check_pictures(folder, rows, path, trouble):
    """Screens are asked once, yes or no; the plan then proposes a picture per slide.
    A yes with no picture column is a plan the reader never saw the screens in, and a
    picture naming an svg that was never drawn is an empty frame on the slide."""
    said = screens_answer(path)
    if said is None:
        trouble.append("the brief never says whether the deck shows the app's screens -- ask, yes or no")
        return
    if said == 'unsaid':                 # the template's prompt: unanswered() already said so
        return
    for no, row in sorted(rows.items()):
        pic = (row['picture'] or '').strip('-–—* ')
        if said == 'yes' and row['picture'] is None:
            trouble.append('slide %s: screens were asked for and the plan proposes no picture '
                           '(a fifth column: screens/<name>.svg, or -)' % no)
            continue
        if said == 'no' and pic:
            trouble.append('slide %s plans a picture (%s) and the reader said no to screens' % (no, pic))
            continue
        for svg in re.findall(r'screens/[\w.-]+\.svg', pic):
            if not (folder / svg).exists():
                trouble.append('slide %s plans %s and it was never drawn -- run build_screens.py'
                               % (no, svg))


def unanswered(path):
    """Lines of the brief's own table still holding the template's prompt.

    The deck-level source is the one that matters: a deck whose brief never says what it
    was read from is a deck nobody can re-derive or correct, however complete its slides
    look. The prompts are the italic parenthesis the template writes.
    """
    out = []
    for line in path.read_text(encoding='utf-8').splitlines():
        if not line.strip().startswith('|'):
            continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells) == 2 and cells[1].startswith('*(') and cells[1].endswith(')*'):
            out.append(cells[0])
    return out


def check_brief(folder, slides, rep):
    rows, path = brief_rows(folder)
    if rows is None:
        rep.bad('brief', 'no brief.md in %s -- the deck has no agreed plan' % folder)
        return
    if not rows:
        rep.bad('brief', '%s holds no slide-plan table' % path.name)
        return
    trouble = []
    for line in unanswered(path):
        trouble.append('%s: still the question the template asked, never answered' % line)
    check_pictures(folder, rows, path, trouble)
    for s in slides:
        row = rows.get(s['no'])
        if row is None:
            trouble.append('slide %s (%s) is in the deck and not in the brief'
                           % (s['no'], s['title'] or s['name']))
            continue
        # the cover shows no data, so it needs no source; every other slide does
        if s['cover']:
            continue
        if row['source'].strip('-–—* ') in ('', '?', 'TBD', 'tbd'):
            trouble.append('slide %s names no source for what it shows' % s['no'])
    for no in sorted(set(rows) - {s['no'] for s in slides}):
        trouble.append('the brief plans slide %s (%s) and the deck has no such slide'
                       % (no, rows[no]['title']))
    if trouble:
        for line in trouble:
            rep.bad('brief', line)
    else:
        rep.ok('brief', '%d slides, every one with a source' % len(slides))


def check_fit(url, rep, allow_grow):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': FRAME_W + 420, 'height': 1000})
        page.goto(url, wait_until='networkidle')
        page.evaluate('document.fonts.ready')
        measured = page.evaluate(MEASURE_JS)
        browser.close()
    trouble = []
    for s in measured:
        if s['down'] > SLACK:
            trouble.append('slide %s %s overflows by %dpx downwards -- the bottom is clipped'
                           % (s['no'], s['name'], s['down']))
        if s['across'] > SLACK:
            trouble.append('slide %s %s overflows by %dpx sideways'
                           % (s['no'], s['name'], s['across']))
        if s['grow'] and not allow_grow:
            trouble.append('slide %s %s is .grow, %dpx tall -- it cannot be one pptx slide '
                           'or one pdf page' % (s['no'], s['name'], s['height']))
    if trouble:
        for line in trouble:
            rep.bad('fit', line)
    else:
        rep.ok('fit', '%d slides inside %dx%d' % (len(measured), FRAME_W, FRAME_H))


def check_edit(url, rep):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': FRAME_W + 420, 'height': 1000})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(url, wait_until='networkidle')
        found = page.evaluate(UNEDITABLE_JS)
        browser.close()
    for e in errors:
        rep.bad('edit', 'page error, edit.js may not have armed the page: %s' % e)
    for u in found['out']:
        rep.bad('edit', 'slide %s %s: "%s" cannot be edited -- put it in an element of its own, '
                        'or mark it data-fixed if it must stay' % (u['no'], u['name'], u['words']))
    if not errors and not found['out']:
        rep.ok('edit', '%d slides, %d editable lines, every line of words editable'
               % (found['slides'], found['armed']))


def main():
    ap = argparse.ArgumentParser(description='check a deck before it is sent')
    ap.add_argument('deck', help='a deck .html, or a folder of them')
    ap.add_argument('--url', default=None, help='base url of the running viewer, for the fit check')
    ap.add_argument('--no-fit', action='store_true', help='skip the browser measurement')
    ap.add_argument('--allow-grow', action='store_true',
                    help='permit .grow slides -- a screen-only deck, never sent as pptx or pdf')
    ap.add_argument('--only', choices=['fit', 'nav', 'marks', 'brief', 'edit'], default=None)
    args = ap.parse_args()

    target = Path(args.deck)
    folder = target if target.is_dir() else target.parent
    decks = deck_nav.decks_in(args.deck)
    if not decks:
        raise SystemExit('no .html in %s' % target)

    rep = Report()
    want = (lambda k: args.only in (None, k))

    for deck in decks:
        print('%s' % deck.name)
        html = deck.read_text(encoding='utf-8')
        slides = deck_nav.slides_of(html)
        if want('nav'):
            slides = check_nav(deck, html, rep) or slides
        if want('marks'):
            check_marks(html, slides, rep)
        if want('brief'):
            check_brief(folder, slides, rep)
        if want('fit'):
            if args.no_fit:
                print('  SKIP  fit    --no-fit: nothing says these slides fit a pdf or a pptx')
            elif not args.url:
                rep.bad('fit', 'no --url, so the slides were never measured. Serve the deck '
                               '(serve.py) and pass its base url, or say --no-fit')
            else:
                check_fit(args.url.rstrip('/') + '/' + deck.name, rep, args.allow_grow)
        if want('edit'):
            if args.no_fit:
                print('  SKIP  edit   --no-fit: nothing says the reader can edit these slides')
            elif not args.url:
                rep.bad('edit', 'no --url, so editing was never checked. Serve the deck and '
                                'pass its base url, or say --no-fit')
            else:
                check_edit(args.url.rstrip('/') + '/' + deck.name, rep)

    print('')
    if rep.failed:
        print('FAILED: %s' % ', '.join(sorted(set(rep.failed))))
        return 1
    print('all checks passed')
    return 0


if __name__ == '__main__':
    sys.exit(main())
