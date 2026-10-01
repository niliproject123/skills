# Layers on a deck

Companion to `SKILL.md` (see its **Layers** section for what a layer is
and where its panel sits). This file is the rules and the recipe.

## The panel

```html
</section>
<div class="qz" data-qz="07">        <!-- data-qz matches the slide's data-no -->
  <div class="qz-hd">…title, legend…</div>
  <div class="qz-in">                <!-- max-height + overflow-y: the panel scrolls itself -->
    <p class="qz-p qz-say"></p>      <!-- the reader's remark box, first so it is seen -->
    <p class="qz-p qz-get">…</p>
    <pre class="qz-yaml"><code>…</code></pre>
  </div>
</div>
```

## Rules a layer has to follow

| | |
|---|---|
| default off | the deck opens unchanged; the toggle is a button in `#bar` **and** a key |
| pick a free key | `edit.js` binds only Ctrl+S, `fit.js` binds nothing. Match on `e.code` so a Hebrew keyboard hits the same physical key, and ignore the press when the target is editable — otherwise typing the letter toggles the layer |
| nothing on a slide with no material | cover, index and question slides get no panel at all, not an empty one |
| off before a save | `edit.js` clones the live document. Turn the layer off in a **capture-phase** handler on `#btn-save` and Ctrl+S, and back on with `setTimeout(…, 0)`, or the class is serialised into the file |
| never leave `class=""` | removing the last class must remove the attribute; the empty attribute is written into the deck |
| two strings you cannot write | `edit.js`'s save guard greps the document for `contenteditable`, so a script mentioning it aborts every save — use `el.isContentEditable`. `deck_edit.py` counts `<section` even inside a comment |
| RTL | Hebrew prose right-aligned; code and YAML in `direction: ltr; text-align: left`, or indentation and identifiers read backwards |

### Making a layer commentable

Layer panels take remarks exactly as slides do — the same inline `michael:` / `מיכאל:`
marker, the same counter, the same drawer. Three things are needed for that, and all three
are already in `edit.js`:

- The arming loop runs over `.slide`, so a panel outside one is **not armed by it**. A
  second pass arms `.qz-p` lines by the same rules.
- `render()` cannot call `closest('.slide')` on a panel line — there is none, and it throws
  instead of listing the remark. `place()` falls back to the panel's own heading, so panel
  remarks and slide remarks read as one list.
- Jumping to a remark inside a switched-off layer lands nowhere, so the drawer calls
  `window.qzReveal()` first. A layer must expose that hook.

**Do not arm a `<pre>` block.** `edit.js` collapses whitespace when it records a line's
original text, so a preformatted block never compares equal to itself and the deck claims
unsaved changes on every load. Give the panel a comment box instead, and put it at the
**top** — a panel scrolls inside itself, and a box below a long code block is a box nobody
finds.

