#!/usr/bin/env python
"""Draw this deck's mockups of the app's screens as svg files in screens/.

Read every label, colour and layout from the app's code first, and name the files here:
    __SOURCES__        e.g. src/App.tsx (theme, tabs), src/components/AlertsView.tsx

No user data is drawn: bar() stands where the app shows a name, a date or a number, and
wave() draws a line's shape, not a price.

    python build_screens.py                                   # writes screens/*.svg
    python <skill>/scripts/screen_mock.py preview .           # look at them: .preview/*.png
"""
import sys
from pathlib import Path

# the primitives live in the html-deck skill - imported, never copied into the deck
sys.path.insert(0, str(Path.home() / '.claude' / 'skills' / 'html-deck' / 'scripts'))
from screen_mock import theme, rect, text, bar, chips, toggle, field, tabs, svg, marked  # noqa: E402,F401

OUT = Path(__file__).resolve().parent / 'screens'

# the app's palette, copied from its theme file (name the file above)
T = theme(bg='#0d1117', paper='#161b22', accent='#00e5ff')


def example_screen():
    """one function per screen, named for the screen - never for the slide it sits on"""
    body = tabs(16, 12, ['First tab', 'Second tab'], 'First tab', t=T)[0]
    body += field(16, 80, 300, 'A field label from the code', t=T)
    body += chips(16, 140, ['On', 'Off'], on=('On',), t=T)[0]
    body += marked(10, 70, 320, 60, 1)                      # callout 1 = `.facts .k .n` 1
    return svg(600, 220, body, T)


SCREENS = {
    'example': example_screen,
}


def main():
    OUT.mkdir(exist_ok=True)
    for name, draw in SCREENS.items():
        (OUT / ('%s.svg' % name)).write_text(draw(), encoding='utf-8')
    print('written: %d screen(s) in %s' % (len(SCREENS), OUT))


if __name__ == '__main__':
    main()
