# -*- coding: utf-8 -*-
"""Apply a batch of edits to a deck, addressed by the line numbers deck_text.py prints.

    python deck_edit.py <deck.html> --ops ops.json [--dry] [--renumber]
    python deck_edit.py <deck.html> --ops -        (ops json on stdin)

ops = [{"op": "set",   "at": "41", "text": "new wording"},        # replace content
       {"op": "set",   "at": "41", "html": "<b>x</b> y"},         # ...with markup
       {"op": "del",   "at": "48"},                               # remove element
       {"op": "after", "at": "52", "html": "<li>added</li>"},     # insert sibling
       {"op": "in",    "at": "47", "html": "<li>added</li>"},     # append child
       {"op": "attr",  "at": "39", "set": {"data-updated": "x"}}]

"at" is the line number from deck_text.py; "41#2" picks the 2nd tag opening on line 41.
Every op resolves against the ORIGINAL file, so line numbers never shift mid-batch.
Nothing is written unless every op resolves and the result re-parses -- no half-applied deck.
Add "mark": true to a set/attr op to flag it `updated` (the green "this is mine" mark).
"""
import io, os, re, sys, json, html as htmlmod
from html.parser import HTMLParser

# A Windows console is cp1252, and a deck title is not: without this the script dies while
# printing the slide it just wrote. Decks are Hebrew, Arabic, Greek more often than not.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


VOID = {'br', 'img', 'link', 'meta', 'input', 'hr', 'area', 'base', 'col',
        'embed', 'source', 'wbr'}
LEAK = ('contenteditable', 'data-edit=', 'data-orig=', 'zoom:')


class Locator(HTMLParser):
    """Every element with the exact character offsets of its open and close tags."""

    def __init__(self, src):
        super().__init__(convert_charrefs=True)
        self.src = src
        self.ls = [0] + [i + 1 for i, ch in enumerate(src) if ch == '\n']
        self.stack, self.els, self.seen = [], [], {}

    def _off(self):
        l, c = self.getpos()
        return self.ls[l - 1] + c

    def handle_starttag(self, tag, attrs):
        line = self.getpos()[0]
        self.seen[line] = self.seen.get(line, 0) + 1
        o = self._off()
        raw = self.get_starttag_text() or ''
        e = {'tag': tag, 'line': line, 'ord': self.seen[line], 'attrs': dict(attrs),
             'os': o, 'oe': o + len(raw), 'cs': None, 'ce': None}
        self.els.append(e)
        if tag in VOID:
            e['cs'] = e['ce'] = e['oe']
        else:
            self.stack.append(e)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if self.stack and self.stack[-1]['tag'] == tag:
            e = self.stack.pop()
            e['cs'] = e['ce'] = e['oe']

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]['tag'] == tag:
                o = self._off()
                gt = self.src.index('>', o) + 1
                self.stack[i]['cs'], self.stack[i]['ce'] = o, gt
                for e in self.stack[i + 1:]:            # implicitly closed
                    if e['cs'] is None:
                        e['cs'] = e['ce'] = o
                del self.stack[i:]
                return


def locate(src):
    p = Locator(src)
    p.feed(src)
    for e in p.stack:
        if e['cs'] is None:
            e['cs'] = e['ce'] = len(src)
    return p.els


def resolve(els, at):
    at = str(at)
    line, _, ordinal = at.partition('#')
    line, ordinal = int(line), int(ordinal or 1)
    hits = [e for e in els if e['line'] == line]
    if not hits:
        raise KeyError('no tag opens on line %s' % line)
    if ordinal > len(hits):
        raise KeyError('line %d has %d tags, asked for #%d (%s)'
                       % (line, len(hits), ordinal, ', '.join(h['tag'] for h in hits)))
    if ordinal == 1 and len(hits) > 1:
        sys.stderr.write('note: line %d opens %d tags (%s); using #1 -- add #N to pick\n'
                         % (line, len(hits), ', '.join(h['tag'] for h in hits)))
    return hits[ordinal - 1]


def set_class(e, src, add):
    raw = src[e['os']:e['oe']]
    if add in e['attrs'].get('class', '').split():
        return None
    if 'class=' in raw:
        new = re.sub(r'class="([^"]*)"',
                     lambda m: 'class="%s %s"' % (m.group(1), add), raw, count=1)
    else:
        new = raw[:len(e['tag']) + 1] + ' class="%s"' % add + raw[len(e['tag']) + 1:]
    return (e['os'], e['oe'], new)


def set_attrs(e, src, pairs):
    raw = src[e['os']:e['oe']]
    for k, v in pairs.items():
        pat = r'\b%s="[^"]*"' % re.escape(k)
        if re.search(pat, raw):
            raw = re.sub(pat, '%s="%s"' % (k, v), raw, count=1)
        else:
            raw = raw[:-1].rstrip() + ' %s="%s">' % (k, v)
    return (e['os'], e['oe'], raw)


def whole_line(src, a, b):
    """Widen a deletion to swallow the line if only whitespace would be left on it."""
    ls = src.rfind('\n', 0, a) + 1
    le = src.find('\n', b)
    le = len(src) if le < 0 else le + 1
    if src[ls:a].strip() == '' and src[b:le].strip() == '':
        return ls, le
    return a, b


def build(src, ops):
    els, edits, problems = locate(src), [], []
    for i, op in enumerate(ops):
        try:
            e = resolve(els, op['at'])
        except KeyError as ex:
            problems.append('op %d: %s' % (i, ex))
            continue
        kind = op['op']
        if kind == 'set':
            body = op['html'] if 'html' in op else htmlmod.escape(op['text'], quote=False)
            edits.append((e['oe'], e['cs'], body))
        elif kind == 'del':
            a, b = whole_line(src, e['os'], e['ce'])
            edits.append((a, b, ''))
        elif kind == 'after':
            pad = ' ' * (e['os'] - src.rfind('\n', 0, e['os']) - 1)
            edits.append((e['ce'], e['ce'], '\n' + pad + op['html']))
        elif kind == 'in':
            edits.append((e['cs'], e['cs'], op['html']))
        elif kind == 'attr':
            edits.append(set_attrs(e, src, op['set']))
        else:
            problems.append('op %d: unknown op %r' % (i, kind))
            continue
        if op.get('mark') and kind in ('set', 'attr'):
            m = set_class(e, src, 'updated')
            if m:
                edits.append(m)
    return edits, problems


def splice(src, edits):
    spans = sorted([e for e in edits if e[0] != e[1]], key=lambda x: x[0])
    for a, b in zip(spans, spans[1:]):
        if a[1] > b[0]:
            raise SystemExit('overlapping edits at %d-%d and %d-%d'
                             % (a[0], a[1], b[0], b[1]))
    for a, b, t in sorted(edits, key=lambda x: (-x[0], -x[1])):
        src = src[:a] + t + src[b:]
    return src


def renumber(src):
    box = [0]

    def sec(m):
        box[0] += 1
        raw = m.group(0)
        if 'data-no=' in raw:
            return re.sub(r'data-no="[^"]*"', 'data-no="%02d"' % box[0], raw)
        return raw[:-1] + ' data-no="%02d">' % box[0]

    src = re.sub(r'<section class="slide[^"]*"[^>]*>', sec, src)
    box[0] = 0

    def badge(m):
        box[0] += 1
        return '<div class="slide-no">%02d</div>' % box[0]

    return re.sub(r'<div class="slide-no">[^<]*</div>', badge, src)


def check(src):
    """Every non-void tag in the file must balance. Generic, so a stray <li> is caught
    as loudly as a stray <section> -- a hand-picked tag list is what let one through."""
    bad = []
    tags = set(re.findall(r'<([a-zA-Z][a-zA-Z0-9]*)[ >/]', src)) - VOID
    for tag in sorted(tags):
        o = len(re.findall(r'<%s[ >]' % tag, src))
        c = src.count('</%s>' % tag)
        if o != c:
            bad.append('%s: %d open vs %d close' % (tag, o, c))
    for leak in LEAK:
        if leak in src:
            bad.append('editing chrome leaked in: %s' % leak)
    for m in re.finditer(u'[֐-׿]\\s*\\d+\\s*[/-]\\s*\\d+', src):
        bad.append('RTL: bare mixed number %r needs <bdi dir="ltr">' % m.group(0))
    return bad


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        return 1
    path = a[0]
    src = io.open(path, encoding='utf-8').read()
    ops = []
    if '--ops' in a:
        o = a[a.index('--ops') + 1]
        ops = json.loads(sys.stdin.read() if o == '-'
                         else io.open(o, encoding='utf-8').read())
    before = check(src)
    edits, problems = build(src, ops)
    if problems:
        sys.stderr.write('NOT WRITTEN -- %d op(s) failed:\n  %s\n'
                         % (len(problems), '\n  '.join(problems)))
        return 2
    out = splice(src, edits)
    if '--renumber' in a:
        out = renumber(out)
    bad = [b for b in check(out) if b not in before]
    if bad:
        sys.stderr.write('NOT WRITTEN -- result is broken:\n  %s\n' % '\n  '.join(bad))
        return 3
    if '--dry' in a:
        import difflib
        for l in difflib.unified_diff(src.splitlines(), out.splitlines(),
                                      'before', 'after', n=1, lineterm=''):
            print(l)
        return 0
    f = io.open(path, 'w', encoding='utf-8', newline='\n')
    f.write(out)
    f.close()
    print('%s: %d op(s) applied, %d -> %d lines'
          % (os.path.basename(path), len(ops), src.count('\n') + 1, out.count('\n') + 1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
