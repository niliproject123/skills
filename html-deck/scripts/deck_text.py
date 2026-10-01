# -*- coding: utf-8 -*-
"""Dump a deck's text content as a flat, greppable outline with line numbers.

    python deck_text.py <deck.html|deck-folder> [--slide 07] [--edits] [--json]

One row per text node:  <line>  <path> | <text>
Markers:  ! michael remark   - deleted line (data-cut)   + marked as updated
The line number is the sed/Edit anchor -- no second lookup needed.
"""
import io, os, sys, json, re
from html.parser import HTMLParser

# A Windows console is cp1252, and a deck title is not: without this the script dies while
# printing the slide it just wrote. Decks are Hebrew, Arabic, Greek more often than not.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


# elements whose text folds into the parent row rather than making its own
MERGE_TAGS = {'bdi','b','i','em','strong','small','br','sub','sup','u','code','wbr'}
MERGE_CLASSES = {'tag','n'}          # badges / step numbers read as part of their line
SKIP_TAGS = {'script','style','head','title'}
CHROME_IDS = {'deckbar','bar','drawer'}

class Dump(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # frames: dict(tag, cls, line, buf, cut, upd)
        self.rows = []           # (slide_no, slide_name, line, path, text, mark)
        self.slide = ('--', '')
        self.slides = []         # (no, name, line)
        self.skip = 0
        self.chrome = 0

    # -- helpers ------------------------------------------------------------
    def _path(self):
        parts = []
        for f in self.stack:
            if f['tag'] in ('body', 'html', 'main'):
                continue
            # 'updated' is a mark, not an identity -- keep the tag visible under it
            cls = ' '.join(c for c in f['cls'].split() if c != 'updated')
            if cls:
                parts.append(cls if cls == f['cls'] else '%s.%s' % (f['tag'], cls))
            elif f['cls'] or f['tag'] in ('h1','h2','h3','h4','li','td','th','p'):
                parts.append(f['tag'])
        return '>'.join(parts[-2:])

    def _flush(self, f):
        text = re.sub(r'\s+', ' ', ''.join(f['buf'])).strip()
        if not text and not f['cut']:
            return
        mark = ' '
        if re.search(r'(michael|מיכאל)\s*:', text): mark = '!'
        elif f['upd']: mark = '+'
        if text:
            self.rows.append((self.slide[0], self.slide[1], f['line'], f['path'], text, mark))
        if f['cut']:
            cut = re.sub(r'\s+', ' ', f['cut']).strip()
            self.rows.append((self.slide[0], self.slide[1], f['line'], f['path'], cut, '-'))

    # -- parser hooks -------------------------------------------------------
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in SKIP_TAGS: self.skip += 1; return
        if self.skip: return
        if a.get('id') in CHROME_IDS: self.chrome += 1; return
        if self.chrome: return
        cls = a.get('class', '')
        if tag == 'section' and 'slide' in cls.split():
            self.slide = (a.get('data-no', '--'), a.get('data-name', ''))
            self.slides.append((self.slide[0], self.slide[1], self.getpos()[0],
                                'updated' if a.get('data-updated') else ''))
            return
        if cls in ('slide-no', 'rule', 'spacer'):
            return
        merge = (tag in MERGE_TAGS) or (cls in MERGE_CLASSES) or (not cls and tag in
                 ('span','div','a') and 'data-cut' not in a)
        if merge:
            if self.stack: self.stack[-1]['buf'].append(' ')   # <b>a</b>b -> "a b"
            return
        self.stack.append({'tag': tag, 'cls': cls, 'line': self.getpos()[0], 'buf': [],
                           'cut': a.get('data-cut', ''), 'upd': 'updated' in cls.split(),
                           'path': ''})
        self.stack[-1]['path'] = self._path()

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS and self.skip: self.skip -= 1; return
        if self.skip: return
        if self.chrome and tag == 'div': self.chrome -= 1; return
        if self.chrome: return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]['tag'] == tag:
                for f in self.stack[i:]:
                    self._flush(f)
                del self.stack[i:]
                return

    def handle_data(self, data):
        if self.skip or self.chrome or not self.stack: return
        if data.strip():
            self.stack[-1]['buf'].append(data)

def dump(path):
    p = Dump()
    p.feed(io.open(path, encoding='utf-8').read())
    for f in p.stack: p._flush(f)
    return p

def show_context(rows, pattern, ctx, as_json):
    """Print each match inside its slide: the slide's own title and kicker for
    orientation, then the matching row with `ctx` rows either side of it."""
    rx = re.compile(pattern)
    slides, order = {}, []
    for r in rows:
        k = (r['deck'], r['slide'])
        if k not in slides:
            slides[k] = []; order.append(k)
        slides[k].append(r)
    hits = 0
    picked = []
    for k in order:
        group = slides[k]
        marks = [i for i, r in enumerate(group) if rx.search(r['text'])]
        if not marks: continue
        hits += len(marks)
        keep = set()
        for i in marks:
            keep.update(range(max(0, i - ctx), min(len(group), i + ctx + 1)))
        # the slide's own heading rows always come along, wherever they sit
        keep.update(i for i, r in enumerate(group)
                    if r['path'].split('>')[-1] in ('title', 'kicker'))
        picked.append((k, group, sorted(keep), set(marks)))
    if as_json:
        out = [dict(g[i], hit=(i in m)) for k, g, keep, m in picked for i in keep]
        print(json.dumps(out, ensure_ascii=False, indent=1))
        return 0
    for (deck, no), group, keep, marks in picked:
        print(u'\n=== %s %s  [%s]  %d match(es)'
              % (no, group[0]['slide_name'], deck, len(marks)))
        prev = None
        for i in keep:
            if prev is not None and i != prev + 1:
                print(u'        ...')
            r = group[i]
            print(u'%s%5d  %-16s| %s'
                  % ('>' if i in marks else ' ', r['line'], r['path'][:16], r['text']))
            prev = i
    print(u'\n%d match(es) in %d slide(s)' % (hits, len(picked)))
    return 0

def main():
    args = sys.argv[1:]
    if not args: print(__doc__); return 1
    target = args[0]
    only   = args[args.index('--slide') + 1] if '--slide' in args else None
    edits  = '--edits' in args
    toc    = '--toc' in args
    as_json= '--json' in args
    find   = args[args.index('--find') + 1] if '--find' in args else None
    ctx    = int(args[args.index('--ctx') + 1]) if '--ctx' in args else 2
    files = ([os.path.join(target, f) for f in sorted(os.listdir(target)) if f.endswith('.html')]
             if os.path.isdir(target) else [target])
    out = []
    for fp in files:
        d = dump(fp)
        name = os.path.basename(fp)
        if toc:
            print(u'\n--- %s' % name)
            for no, sname, line, upd in d.slides:
                n = len([r for r in d.rows if r[0] == no])
                print(u'%s  %s:%-5d %-3s %-44s %d lines'
                      % ('+' if upd else ' ', name, line, no, sname, n))
            continue
        for no, sname, line, path, text, mark in d.rows:
            if only and no != only: continue
            if edits and mark == ' ' and not find: continue
            out.append({'deck': name, 'slide': no, 'slide_name': sname,
                        'line': line, 'path': path, 'text': text, 'mark': mark})
    if toc: return 0
    if find:
        return show_context(out, find, ctx, as_json)
    if as_json:
        print(json.dumps(out, ensure_ascii=False, indent=1)); return 0
    cur = None
    for r in out:
        key = (r['deck'], r['slide'])
        if key != cur:
            cur = key
            print(u'\n=== %s %s  %s' % (r['slide'], r['slide_name'], r['deck']))
        print(u'%s%5d  %-16s| %s' % (r['mark'], r['line'], r['path'][:16], r['text']))
    return 0

sys.exit(main())
