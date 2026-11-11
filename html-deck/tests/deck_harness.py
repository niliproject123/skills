# -*- coding: utf-8 -*-
"""What the drawings tests share: a throwaway copy of a real deck, served by the real
serve.py, and a result list that prints PASS / FAIL and becomes the report.

Nothing is mocked. The deck is a copy of a deck folder built with the skill's own
scripts (deck_new.py, screen_mock.py, deck_draw.py); the server is serve.py; the page
runs the real edit.js, lightbox.js and draw.js in Chromium.
"""
import io
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(SKILL, 'scripts')
sys.path.insert(0, SCRIPTS)


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


class DeckCopy(object):
    """A copy of `source` in a temp folder, served on a free port until close()."""
    def __init__(self, source, assets=SCRIPTS):
        self.dir = tempfile.mkdtemp(prefix='deck-drawings-')
        self.folder = os.path.join(self.dir, 'deck')
        shutil.copytree(source, self.folder, ignore=shutil.ignore_patterns('.bak', '.preview'))
        self.file = os.path.join(self.folder, 'deck.html')
        self.port = free_port()
        self.base = 'http://127.0.0.1:%d/' % self.port
        self.log = open(os.path.join(self.dir, 'serve.log'), 'w', encoding='utf-8')
        self.proc = subprocess.Popen([sys.executable, os.path.join(assets, 'serve.py'), self.folder,
                                      str(self.port)], stdout=self.log, stderr=subprocess.STDOUT)
        for _ in range(50):
            try:
                urllib.request.urlopen(self.base + 'deck.html', timeout=1)
                return
            except Exception:
                time.sleep(0.2)
        self.close()
        raise SystemExit('serve.py did not answer on port %d -- see %s' % (self.port, self.dir))

    def text(self):
        return io.open(self.file, encoding='utf-8', newline='').read()

    def write(self, text):
        io.open(self.file, 'w', encoding='utf-8', newline='').write(text)

    def close(self):
        self.proc.terminate()
        self.proc.wait(timeout=10)
        self.log.close()
        shutil.rmtree(self.dir, ignore_errors=True)


class Results(object):
    def __init__(self, title):
        self.title, self.rows = title, []

    def check(self, name, ok, detail=''):
        self.rows.append((name, bool(ok), detail))
        print('  %s  %s%s' % ('PASS' if ok else 'FAIL', name, ('  -- ' + detail) if detail else ''))
        return ok

    def failed(self):
        return [r for r in self.rows if not r[1]]

    def markdown(self, mocked):
        out = ['# ' + self.title, '', '| result | check | detail |', '|---|---|---|']
        out += ['| %s | %s | %s |' % ('PASS' if ok else '**FAIL**', n, d.replace('|', '/'))
                for n, ok, d in self.rows]
        out += ['', '**%d passed, %d failed.**' % (len(self.rows) - len(self.failed()), len(self.failed())),
                '', '## Mocked data', '', mocked, '']
        return '\n'.join(out)


def watch_errors(page, sink):
    """Every page error and console error, so a test cannot pass over one."""
    page.on('pageerror', lambda e: sink.append('pageerror: %s' % e))
    page.on('console', lambda m: sink.append('console.%s: %s' % (m.type, m.text))
            if m.type == 'error' else None)
