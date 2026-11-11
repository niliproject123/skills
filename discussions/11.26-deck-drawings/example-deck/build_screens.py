#!/usr/bin/env python
"""Example screens for the drawings demo deck: a made-up dashboard and a phone screen.
No app is described: these exist only so the deck has pictures to draw on.

    python build_screens.py            # writes screens/*.svg
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'html-deck' / 'scripts'))
from screen_mock import theme, rect, text, bar, chips, tabs, svg, wave, smooth  # noqa: E402

OUT = Path(__file__).resolve().parent / 'screens'
T = theme(bg='#0d1117', paper='#161b22', accent='#00e5ff')


def dashboard():
    body = tabs(16, 12, ['Overview', 'Alerts', 'Settings'], 'Overview', t=T)[0]
    body += rect(16, 64, 360, 110, fill=T['paper'], stroke=T['line'])
    body += text(32, 92, 'Open alerts', 13, T['muted']) + text(32, 140, '12', 40, T['text'], 700)
    body += rect(392, 64, 360, 110, fill=T['paper'], stroke=T['line'])
    body += text(408, 92, 'Response time', 13, T['muted']) + bar(408, 124, 180, 14, t=T)
    body += rect(768, 64, 416, 110, fill=T['paper'], stroke=T['line'])
    body += chips(784, 104, ['Live', 'Paused', 'Archived'], on=('Live',), t=T)[0]
    body += rect(16, 190, 1168, 380, fill=T['paper'], stroke=T['line'])
    pts = wave(7, 40, 40, 1160, 380, 120)
    body += "<path d='%s' fill='none' stroke='%s' stroke-width='3'/>" % (smooth(pts), T['series'][0])
    body += rect(16, 590, 1168, 94, fill=T['paper'], stroke=T['line'])
    for i in range(4):
        body += bar(40, 612 + i * 18, 300 + i * 120, 9, t=T)
    return svg(1200, 700, body, T)


def phone():
    body = rect(0, 0, 390, 64, fill=T['paper']) + text(20, 40, 'Alerts', 20, T['text'], 700)
    for i in range(6):
        y = 84 + i * 104
        body += rect(16, y, 358, 88, fill=T['paper'], stroke=T['line'])
        body += bar(32, y + 22, 200, 10, t=T) + bar(32, y + 50, 280, 8, t=T)
    body += rect(16, 720, 358, 48, fill=T['accent'], r=24) + text(195, 750, 'New alert', 15, '#0d1117', 700, 'middle')
    return svg(390, 780, body, T)


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    (OUT / 'dashboard.svg').write_text(dashboard(), encoding='utf-8')
    (OUT / 'phone.svg').write_text(phone(), encoding='utf-8')
    print('screens/dashboard.svg, screens/phone.svg')
