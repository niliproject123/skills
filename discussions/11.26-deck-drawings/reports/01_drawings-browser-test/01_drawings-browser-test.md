# Drawings and full screen -- browser test

| result | check | detail |
|---|---|---|
| PASS | refactor: a save with edit.js at ae02c82 and with the split files is byte-identical | 6396 vs 6396 bytes |
| PASS | tools load (edit.js loads edit_changes.js, lightbox.js, draw.js) |  |
| PASS | clear-all button shows the 3 drawings from deck_draw.py | נקה ציורים · 3 |
| PASS | click on a picture opens full screen |  |
| PASS | full screen is bigger than the slide picture and keeps its shape | 1371x800 vs 800 wide on the slide |
| PASS | Esc closes full screen |  |
| PASS | the x button closes full screen |  |
| PASS | a click on the dark area closes full screen |  |
| PASS | after a drag the label box opens |  |
| PASS | a click without a drag draws nothing |  |
| PASS | the drawings reach the slide | {'n': 2, 'vb': '0 0 1000 583', 'x': 200, 'w': 300, 'labels': ['בדיקה & <תג>', 'חץ']} |
| PASS | the box sits where it was drawn (20%..50% across) | x=200 w=300 |
| PASS | labels kept as typed, & and < included | ['בדיקה & <תג>', 'חץ'] |
| PASS | saved: the file has the drawings | 5 drawings in the file |
| PASS | saved: no editor chrome in the file |  |
| PASS | saved: the slide list keeps no "here" mark (nav.js runtime state) |  |
| PASS | after reload the drawings are still there |  |
| PASS | drawings stay on their picture at 900px and 1900px wide | largest shift 0.0000 of the picture |
| PASS | double click relabels a deck_draw.py arrow |  |
| PASS | click + Delete removes a drawing |  |
| PASS | "clear picture" unwraps that picture only |  |
| PASS | "clear drawings" removes every drawing |  |
| PASS | saved after clearing: no drawings in the file |  |
| PASS | draw.js and deck_draw.py write identical markup (6 cases, wide and tall) |  |
| PASS | deck_draw.py add + clear returns the file byte for byte |  |
| PASS | no page or console errors during the run |  |

**26 passed, 0 failed.**

## Mocked data

None. A copy of a real deck (built with deck_new.py, screen_mock.py, deck_draw.py) served by serve.py, driven in headless Chromium. Confirm dialogs are accepted.
