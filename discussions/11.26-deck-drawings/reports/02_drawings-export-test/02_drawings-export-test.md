# Drawings in the exports -- pptx (picture, editable) and pdf

| result | check | detail |
|---|---|---|
| PASS | picture pptx: 4 slides | 4 slides |
| PASS | picture pptx: drawings on 03 and 04, none on 02 | red pixels {'01': 0, '02': 0, '03': 1654, '04': 376} |
| PASS | editable pptx 02: 1 picture, 0 box, 0 arrow, labels as text | pictures 1, boxes 0, arrows 0, labels found True |
| PASS | editable pptx 03: 1 picture, 1 box, 1 arrow, labels as text | pictures 1, boxes 1, arrows 1, labels found True |
| PASS | editable pptx 04: 1 picture, 1 box, 0 arrow, labels as text | pictures 1, boxes 1, arrows 0, labels found True |
| PASS | pdf: one page per slide | 4 pages |
| PASS | pdf: drawings on 03 and 04, none on 02 | red pixels {'01': 0, '02': 0, '03': 2001, '04': 384} |
| PASS | pdf: label words are real text |  |
| PASS | no page or console errors while printing |  |

**9 passed, 0 failed.**

## Mocked data

None. The real exporters (to_pptx.py, to_pptx_native.py, Chromium print) on a copy of a real deck served by serve.py.
