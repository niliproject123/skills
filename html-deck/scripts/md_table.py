# -*- coding: utf-8 -*-
"""Turn a Markdown document that is mostly tables into one deck HTML file.

    python md_table.py <input.md> <output.html> [--title "..."] [--name "..."]
                       [--here <basename>] [--foot "..."] [--check]

Mapping
    # H1                 -> .slide.cover   (h1 + .sub + .strip + .foot)
    ## H2 / ### H3       -> a new slide    (h1.title + .rule + p.kicker)
    > quote              -> .note          (at most one per slide; several merge)
    other paragraph      -> .facts > .b    (one .b per paragraph / list item)
    | a | markdown | table |  -> table.grid, header row as <th>

Only classes that already exist in deck.css AND appear in TARGETS in edit.js are
emitted, so every line the converter writes is clickable and rewritable in the
browser.  Nothing new is added to deck.css.

The deckbar is copied verbatim from a sibling deck in the output folder, so the
tab strip cannot drift from the rest of the round; this page's own tab is added
with class="here".
"""
import io, os, re, sys, math, json, html as htmlmod

SLIDE_W, SLIDE_H = 1280, 720
PAD_H = 46 + 40                       # .slide padding top + bottom
BUDGET = SLIDE_H - PAD_H              # usable height before a slide must .grow
SAFETY = 0.85                         # the estimate is approximate; .slide clips, so
                                      # spend the last 15% on .grow rather than on a
                                      # cut-off row. A .grow slide whose content fits
                                      # is pixel-identical (height:auto, min-height 720)
GROW_ROWS = 6                         # a table with more body rows than this grows
SPLIT_ROWS = 14                       # several tables in one section split past this

# The RTL guard, byte for byte the test deck_edit.check() applies to the file it
# is asked to write.  Anything it would reject is wrapped here instead.
MIXNUM_RAW = re.compile(u'[֐-׿]\\s*\\d+\\s*[/-]\\s*\\d+')
MIXNUM_SUB = re.compile(u'([֐-׿])(\\s*)(\\d+\\s*[/-]\\s*\\d+)')

KEEP = re.compile(r'(<bdi dir="ltr">.*?</bdi>|<br\s*/?>)', re.S)
LINK = re.compile(r'\[([^\]]*)\]\(([^)]*)\)')
CODE = re.compile(r'`([^`]+)`')
BOLD = re.compile(r'\*\*(.+?)\*\*')
STRIKE = re.compile(r'~~(.+?)~~')
ITAL = re.compile(r'(?<![\*\w])\*([^*\n]+)\*(?!\*)')


# ---------------------------------------------------------------- inline text

def _md_inline(esc):
    """Markdown emphasis on already-escaped text.  Code spans are parked first so
    a backtick span holding an asterisk is not read as emphasis."""
    esc = LINK.sub(lambda m: m.group(1), esc)          # a deck has no outbound links
    parked = []

    def park(m):
        parked.append(m.group(1))
        return '\x00%d\x00' % (len(parked) - 1)

    esc = CODE.sub(park, esc)
    esc = BOLD.sub(lambda m: '<b>%s</b>' % m.group(1), esc)
    esc = STRIKE.sub(lambda m: '<s>%s</s>' % m.group(1), esc)
    esc = ITAL.sub(lambda m: '<i>%s</i>' % m.group(1), esc)
    for i, c in enumerate(parked):
        esc = esc.replace('\x00%d\x00' % i, '<code>%s</code>' % c)
    return esc


def _wrap_mixed(html):
    """Wrap every bare mixed number in <bdi dir="ltr">.  Only text that sits
    outside a tag is touched, and text already inside a <bdi> is left alone."""
    out, depth = [], 0
    for part in re.split(r'(<[^>]*>)', html):
        if part.startswith('<'):
            if re.match(r'<bdi[\s>]', part):
                depth += 1
            elif part == '</bdi>':
                depth = max(0, depth - 1)
            out.append(part)
        elif depth:
            out.append(part)
        else:
            out.append(MIXNUM_SUB.sub(
                lambda m: '%s%s<bdi dir="ltr">%s</bdi>' % (m.group(1), m.group(2), m.group(3)),
                part))
    return ''.join(out)


BOLD_SPAN = re.compile(r'\*\*(.+?)\*\*', re.S)
B_OPEN, B_SHUT = '\x01', '\x02'   # placeholders no source text can contain


def inline(raw):
    """Markdown fragment -> deck HTML.  Everything not explicitly kept is escaped.

    Bold is resolved over the WHOLE fragment before the kept tags are split out.
    These tables are full of **... <bdi dir="ltr">R</bdi> ...**, and splitting first
    put the two halves of the ** in different segments, so neither matched and both
    reached the page as literal asterisks."""
    raw = BOLD_SPAN.sub(lambda m: B_OPEN + m.group(1) + B_SHUT, raw)
    out = []
    for i, part in enumerate(KEEP.split(raw)):
        if i % 2:                                     # a kept <bdi>/<br> verbatim
            out.append('<br>' if part.lower().startswith('<br') else part)
        else:
            out.append(_md_inline(htmlmod.escape(part, quote=False)))
    return _wrap_mixed(''.join(out)).replace(B_OPEN, '<b>').replace(B_SHUT, '</b>')


MARKER = '{{u}}'


def split_mark(raw):
    """A cell or paragraph opening with {{u}} carries class="updated" -- the green mark
       the reader jumps between in the change drawer.  The marker never reaches the page.

       Every mark needs a matching entry in changes.json, in document order: edit.js
       pairs the two by position and throws the whole record away when the counts
       disagree.  This function only makes the mark; writing the entry is the caller's
       job, and forgetting it is silent."""
    s = raw.lstrip()
    if s.startswith(MARKER):
        return True, s[len(MARKER):].lstrip()
    return False, raw


def plain(html):
    """Visible text of a fragment, with <br> as a newline -- for height estimates."""
    t = re.sub(r'<br\s*/?>', '\n', html)
    t = re.sub(r'<[^>]+>', '', t)
    return htmlmod.unescape(t)


def lines_of(html, cpl):
    n = 0
    for seg in plain(html).split('\n'):
        n += max(1, int(math.ceil(len(seg) / float(cpl))))
    return n


# ------------------------------------------------------------------ md blocks

SEP = re.compile(r'^\|[\s:|-]+\|\s*$')


def cells(line):
    row = line.strip()
    if row.startswith('|'):
        row = row[1:]
    if row.endswith('|'):
        row = row[:-1]
    return [c.strip() for c in row.split('|')]


def read_blocks(src):
    """Flat list of ('h',lvl,text) ('table',rows) ('quote',t) ('para',t) blocks."""
    lines = src.replace('\r\n', '\n').split('\n')
    blocks, i, para = [], 0, []

    def flush():
        if para:
            blocks.append(('para', ' '.join(para).strip()))
            del para[:]

    while i < len(lines):
        ln = lines[i]
        s = ln.strip()
        h = re.match(r'^(#{1,6})\s+(.*\S)\s*$', s)
        if not s:
            flush()
        elif h:
            flush()
            blocks.append(('h', len(h.group(1)), h.group(2)))
        elif re.match(r'^(-{3,}|\*{3,}|_{3,})$', s):
            flush()                                   # a horizontal rule is chrome
        elif s.startswith('>'):
            flush()
            q = []
            while i < len(lines) and lines[i].strip().startswith('>'):
                q.append(re.sub(r'^>\s?', '', lines[i].strip()))
                i += 1
            blocks.append(('quote', ' '.join(x for x in q if x).strip()))
            continue
        elif s.startswith('|') and i + 1 < len(lines) and SEP.match(lines[i + 1]):
            flush()
            head = cells(s)
            i += 2
            body = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                body.append(cells(lines[i]))
                i += 1
            blocks.append(('table', [head] + body))
            continue
        elif re.match(r'^([-*+]|\d+\.)\s+', s):
            flush()
            blocks.append(('para', re.sub(r'^([-*+]|\d+\.)\s+', '', s)))
        else:
            para.append(s)
        i += 1
    flush()
    return blocks


# ------------------------------------------------------------------- assembly

class Slide(object):
    def __init__(self, title):
        self.title, self.kicker, self.note = title, None, []
        self.body = []                                # ('facts', [b...]) / ('table', rows)

    def add_para(self, t):
        if self.body and self.body[-1][0] == 'facts':
            self.body[-1][1].append(t)
        else:
            self.body.append(('facts', [t]))

    def rows(self):
        return sum(len(b[1]) - 1 for b in self.body if b[0] == 'table')

    def tables(self):
        return [b for b in self.body if b[0] == 'table']


def to_slides(blocks):
    cover, slides, cur = None, [], None
    for b in blocks:
        if b[0] == 'h' and b[1] == 1 and cover is None and not slides:
            cover = {'h1': b[2], 'sub': None, 'strip': []}
            cur = None
            continue
        if b[0] == 'h' and b[1] >= 2:
            cur = Slide(b[2])
            slides.append(cur)
            continue
        if b[0] == 'h':
            continue
        if cur is None:                               # still on the cover
            if cover is None:
                cover = {'h1': '', 'sub': None, 'strip': []}
            if b[0] == 'para':
                if cover['sub'] is None:
                    cover['sub'] = b[1]
                else:
                    cover['strip'].append(b[1])
            elif b[0] == 'quote':
                cover['strip'].append(b[1])
            continue
        if b[0] == 'quote':
            cur.note.append(b[1])
        elif b[0] == 'para':
            if cur.kicker is None and not cur.body:
                cur.kicker = b[1]
            else:
                cur.add_para(b[1])
        elif b[0] == 'table':
            cur.body.append(('table', b[1]))
    return cover, slides


def split_slides(slides):
    """One H2 section keeps its tables together until they pass SPLIT_ROWS."""
    out = []
    for s in slides:
        tbl = s.tables()
        if len(tbl) < 2 or s.rows() <= SPLIT_ROWS:
            out.append(s)
            continue
        parts, cur, n = [], [], 0
        for b in s.body:
            rows = len(b[1]) - 1 if b[0] == 'table' else 0
            if cur and n + rows > SPLIT_ROWS:
                parts.append(cur)
                cur, n = [], 0
            cur.append(b)
            n += rows
        if cur:
            parts.append(cur)
        for k, body in enumerate(parts):
            t = Slide(s.title if k == 0 else u'%s — המשך %d' % (s.title, k + 1))
            t.body = body
            if k == 0:
                t.kicker, t.note = s.kicker, s.note
            out.append(t)
    return out


# ------------------------------------------------------------------ rendering

def table_html(rows, pad):
    head, body = rows[0], rows[1:]
    n = max(len(r) for r in rows)
    o = ['%s<table class="grid">' % pad, '%s  <tr>' % pad]
    for c in head + [''] * (n - len(head)):
        o.append('%s    <th>%s</th>' % (pad, inline(c)))
    o.append('%s  </tr>' % pad)
    for r in body:
        o.append('%s  <tr>' % pad)
        for c in r + [''] * (n - len(r)):
            marked, c = split_mark(c)
            o.append('%s    <td%s>%s</td>'
                     % (pad, ' class="updated"' if marked else '', inline(c)))
        o.append('%s  </tr>' % pad)
    o.append('%s</table>' % pad)
    return o


def table_height(rows):
    n = max(len(r) for r in rows)
    cpl = max(4, ((SLIDE_W - 116) / float(n) - 24) / 7.3)
    h = 38.0                                          # header row
    for r in rows[1:]:
        h += 17 + 22.5 * max(lines_of(inline(c), cpl) for c in (r or ['']))
    return h


def slide_height(s):
    h = 49.0 + 25.0                                   # h1.title + .rule
    if s.kicker:
        h += 26 + 26.4 * lines_of(inline(s.kicker), 117)
    for kind, val in s.body:
        if kind == 'facts':
            for b in val:
                h += 13.6 + 21.6 * lines_of(inline(b), 161)
            h += 8
        else:
            h += table_height(val) + 14
    if s.note:
        h += 44 + 24.8 * lines_of(inline(' '.join(s.note)), 150)
    return h


def grows(s):
    if any(len(b[1]) - 1 > GROW_ROWS for b in s.tables()):
        return True
    return slide_height(s) > BUDGET * SAFETY


def render_slide(s, no):
    cls = 'slide grow' if grows(s) else 'slide'
    o = ['<section class="%s" data-no="%02d" data-name="%s">'
         % (cls, no, htmlmod.escape(plain(inline(s.title)), quote=True)),
         '  <div class="slide-no">%02d</div>' % no,
         '  <h1 class="title">%s</h1>' % inline(s.title),
         '  <div class="rule"></div>']
    if s.kicker:
        marked, k = split_mark(s.kicker)
        o.append('  <p class="kicker%s">%s</p>'
                 % (' updated' if marked else '', inline(k)))
    for kind, val in s.body:
        if kind == 'facts':
            o.append('  <div class="facts">')
            for b in val:
                marked, b = split_mark(b)
                o.append('    <div class="b%s">%s</div>'
                         % (' updated' if marked else '', inline(b)))
            o.append('  </div>')
        else:
            o += table_html(val, '  ')
    if s.note:
        o.append('  <div class="note">%s</div>' % inline(' '.join(s.note)))
    o.append('</section>')
    return o


def render_cover(cover, foot):
    strip = '<br>'.join(inline(p) for p in cover['strip'])
    sub = inline(cover['sub'] or '')
    top = 120 if len(plain(strip)) + len(plain(sub)) < 260 else 40
    return ['<section class="slide cover" data-no="01" data-name="שער">',
            '  <div class="slide-no">01</div>',
            '  <div style="margin-top:%dpx">' % top,
            '    <h1>%s</h1>' % inline(cover['h1']),
            '    <div class="sub">%s</div>' % sub,
            '    <div class="strip">%s</div>' % strip,
            '  </div>',
            '  <div class="foot"><span></span><span>%s</span></div>' % inline(foot),
            '</section>']


# -------------------------------------------------------------------- deckbar

def div_block(src, start):
    """The <div id="deckbar"> element, balanced over its nested divs."""
    i, depth = start, 0
    while i < len(src):
        m = re.compile(r'</?div\b').search(src, i)
        if not m:
            return src[start:]
        depth += 1 if src[m.start():m.start() + 5] == '<div ' or \
            src[m.start():m.start() + 4] == '<div' and src[m.start() + 4] in '> ' else -1
        i = src.index('>', m.start()) + 1
        if depth == 0:
            return src[start:i]
    return src[start:]


def _majority(items):
    """(votes, tie-breakers) winner over identical values -- so one odd sibling
    never decides the chrome for the folder."""
    groups = {}
    for key, extra, fn in items:
        g = groups.setdefault(key, [0, extra, fn])
        g[0] += 1
        g[2] = min(g[2], fn)
    if not groups:
        return None
    key = sorted(groups, key=lambda k: (-groups[k][0], -groups[k][1], groups[k][2]))[0]
    return key, groups[key][2]


def sibling_deckbar(folder, skip):
    items = []
    for fn in sorted(os.listdir(folder)):
        if not fn.endswith('.html') or fn == skip:
            continue
        head = io.open(os.path.join(folder, fn), encoding='utf-8',
                       errors='replace').read(200000)
        k = head.find('<div id="deckbar"')
        if k < 0:
            continue
        bar = div_block(head, k).replace(' class="here"', '')
        items.append((bar, len(re.findall(r'<a\b', bar)), fn))
    win = _majority(items)
    return (0, win[1], win[0]) if win else None


def build_deckbar(folder, out_name, here, tab):
    got = sibling_deckbar(folder, out_name)
    if not got:
        return ('<div id="deckbar"><span class="name">%s</span>\n'
                '  <a class="here" href="/%s">%s</a>\n</div>' % (tab, here, tab)), None
    _, src_name, bar = got
    bar = bar.replace(' class="here"', '')
    bar = re.sub(r'\n?\s*<a[^>]*href="/?%s"[^>]*>.*?</a>' % re.escape(here), '', bar)
    tag = '\n  <a class="here" href="/%s">%s</a>' % (here, tab)
    if '<div class="spacer">' in bar:
        bar = bar.replace('\n  <div class="spacer">', tag + '\n  <div class="spacer">', 1)
    else:
        bar = bar[:bar.rfind('</div>')].rstrip() + tag + '\n</div>'
    return bar, src_name


def favicon(folder, skip):
    items = []
    for fn in sorted(os.listdir(folder)):
        if fn.endswith('.html') and fn != skip:
            head = io.open(os.path.join(folder, fn), encoding='utf-8',
                           errors='replace').read(20000)
            m = re.search(r'<link rel="icon"[^>]*>', head)
            if m:
                items.append((m.group(0), 0, fn))
    win = _majority(items)
    return win[0] if win else ''


# ------------------------------------------------------------------------ cli

HEAD = u'''<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>%(title)s</title>
%(icon)s<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;600;700;800&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="/_deck/deck.css">
<link rel="stylesheet" href="/_deck/edit.css">
</head>
<body class="has-deckbar"%(notes)s>

%(deckbar)s
'''

TAIL = u'''
<div id="drawer"></div>
<div id="bar">
  <span>שינויים: <span class="count" id="cnt">0</span></span>
  <span>הערות: <span class="notes" id="notes">0</span></span>
  <button id="btn-list">מה שיניתי</button>
  <button id="btn-save" class="go">שמור</button>
  <button id="btn-clr">בטל שינויים</button>
  <div class="spacer"></div>
  <span id="status">טוען…</span>
</div>
<script src="/_deck/edit.js"></script>
<script src="/_deck/fit.js"></script>
</body>
</html>
'''


def arg(a, flag, default=None):
    return a[a.index(flag) + 1] if flag in a else default


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        print(__doc__)
        return 1
    src_path, out_path = a[0], a[1]
    src = io.open(src_path, encoding='utf-8').read()
    cover, slides = to_slides(read_blocks(src))
    slides = split_slides(slides)
    if cover is None:
        sys.stderr.write('NOT WRITTEN -- no "# H1" heading found in %s\n' % src_path)
        return 2

    folder = os.path.dirname(os.path.abspath(out_path))
    out_name = os.path.basename(out_path)
    title = arg(a, '--title', cover['h1'])
    tab = arg(a, '--name', title)
    here = arg(a, '--here', out_name)
    foot = arg(a, '--foot', '')
    bar, from_deck = build_deckbar(folder, out_name, here, tab)

    body = render_cover(cover, foot)
    for i, s in enumerate(slides):
        body.append('')
        body += render_slide(s, i + 2)
    html = (HEAD % {'title': htmlmod.escape(title, quote=False),
                    'notes': ' data-notes="off"' if '--no-notes' in a else '',
                    'icon': (favicon(folder, out_name) + '\n') if favicon(folder, out_name) else '',
                    'deckbar': bar}
            + '\n'.join(body) + TAIL)

    bad = [m.group(0) for m in MIXNUM_RAW.finditer(html)]
    print('%s -> %s' % (os.path.basename(src_path), out_name))
    print('  slides      : %d  (cover + %d sections)' % (len(slides) + 1, len(slides)))
    print('  deckbar from: %s' % (from_deck or '(none -- built a minimal one)'))
    print('  grow slides : %s' % ', '.join(
        '%02d' % (i + 2) for i, s in enumerate(slides) if grows(s)))
    for i, s in enumerate(slides):
        print('  %02d %-4s rows=%-3d tables=%d  %s'
              % (i + 2, 'grow' if grows(s) else '', s.rows(), len(s.tables()), s.title))
    if bad:
        sys.stderr.write('RTL: %d bare mixed number(s) survived the wrap: %s\n'
                         % (len(bad), bad[:5]))
        return 3
    if '--check' in a:
        print('  --check: nothing written')
        return 0
    f = io.open(out_path, 'w', encoding='utf-8', newline='\n')
    f.write(html)
    f.close()
    print('  written     : %d lines' % (html.count('\n') + 1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
