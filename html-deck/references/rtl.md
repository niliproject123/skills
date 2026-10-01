# Right-to-left

## RTL rules

Learned the hard way; violating these ships wrong numbers to a reader.

- **Wrap every mixed number in `<bdi dir="ltr">`.** `20 / 26` renders as `26 / 20`
  in an RTL paragraph without it. Same for `ג-14`, `544/51`, version numbers, ranges.
- **Never use arrows to carry sequence.** A chevron or `→` has to be flipped for RTL
  and gets it wrong silently. Number the steps instead — `.steps` exists for this.
- Set `dir="rtl"` on `<html>`, not per-element.

