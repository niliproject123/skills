/* Drawings over a slide picture: boxes and arrows, each with an optional label.

   Drawn in the full-screen view (lightbox.js): pick "box" or "arrow", drag on the
   picture, type the label, Enter. A click on a drawing selects it; Delete removes it,
   a double click rewrites its label. "Clear picture" empties one picture, the bar's
   "Clear drawings" empties the whole deck.

   In the file a drawing is plain svg inside the slide, so it is printed, exported and
   kept like any other content:

     <span class="drawn-on"><img ...><svg class="drawings" viewBox="0 0 1000 H">
       <g class="dw" data-kind="box"><rect .../><text ...>label</text></g>
       <g class="dw" data-kind="arrow"><line .../><polygon .../><text ...>label</text></g>
     </svg></span>

   The viewBox is 1000 wide and as tall as the picture's shape, so a drawing scales with
   the picture at any size. deck_draw.py writes the same markup from the command line --
   shapeMarkup() below and deck_draw.py's shape_markup() must stay the same geometry;
   tests/drawings_test.py compares the two. A picture whose last drawing is removed is
   unwrapped again, so the file goes back to what it was. */
(function () {
  var E = window.deckEdit, LB = window.deckLightbox, say = E.say;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var COLOR = '#E5484D';
  var WIDTH = 1000;                   /* viewBox width; the height follows the picture */
  var SMALLEST = 12;                  /* a drag shorter than this (viewBox units) is a click */
  var RTL = (document.documentElement.getAttribute('dir') ||
             document.body.getAttribute('dir')) === 'rtl';

  function r1(v) { return Math.round(v * 10) / 10; }

  /* ---------- the geometry, shared with deck_draw.py ---------- */
  /* Returns the inner markup of one <g class="dw">: the shape, and the label if any.
     a, b: {x, y} in viewBox units -- the corners of a box, or the tail and tip of an arrow.
     height: the viewBox height. Line and letters are sized on the picture's LONGER side:
     sized on its width, a tall phone screen got a 5px label on the slide. */
  function shapeMarkup(kind, a, b, label, rtl, height) {
    var long = Math.max(WIDTH, height);
    var sw = long / 200, fs = long / 40, out = [], tx, ty, anchor;
    function attrs(o) {
      return Object.keys(o).map(function (k) { return k + '="' + o[k] + '"'; }).join(' ');
    }
    if (kind === 'box') {
      var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      var w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      out.push('<rect ' + attrs({ x: r1(x), y: r1(y), width: r1(w), height: r1(h),
        rx: r1(sw), fill: 'none', stroke: COLOR, 'stroke-width': r1(sw) }) + '></rect>');
      /* the label sits above the box, on the side the deck reads from; when the box
         touches the top of the picture there is no room above, so it goes inside */
      anchor = rtl ? 'end' : 'start';
      tx = rtl ? x + w : x;
      ty = y - fs * 0.4 > fs ? y - fs * 0.4 : y + fs + sw;
      if (!(y - fs * 0.4 > fs)) tx += rtl ? -sw * 2 : sw * 2;
    } else {
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / len, uy = dy / len, head = sw * 4.5, half = sw * 2.6;
      var bx = b.x - ux * head, by = b.y - uy * head;
      out.push('<line ' + attrs({ x1: r1(a.x), y1: r1(a.y),
        x2: r1(b.x - ux * head * 0.6), y2: r1(b.y - uy * head * 0.6),
        stroke: COLOR, 'stroke-width': r1(sw), 'stroke-linecap': 'round' }) + '></line>');
      out.push('<polygon ' + attrs({ points: [r1(b.x), r1(b.y), r1(bx - uy * half),
        r1(by + ux * half), r1(bx + uy * half), r1(by - ux * half)].join(' '),
        fill: COLOR }) + '></polygon>');
      /* the label sits behind the tail, so the arrow points away from its words */
      anchor = ux > 0.3 ? 'end' : ux < -0.3 ? 'start' : 'middle';
      tx = a.x - ux * fs * 0.5;
      ty = a.y - uy * fs * 0.9 + fs * 0.35;
    }
    if (label) {
      out.push('<text ' + attrs({ x: r1(tx), y: r1(ty), 'text-anchor': anchor,
        'font-size': r1(fs), 'font-weight': 700, fill: COLOR, stroke: '#fff',
        'stroke-width': r1(fs * 0.18), 'stroke-linejoin': 'round',
        'paint-order': 'stroke' }) + '>' + esc(label) + '</text>');
    }
    return out.join('');
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------- the picture's svg ---------- */
  function svgOf(frame) { return frame.querySelector(':scope > svg.drawings'); }

  /* the copy in the full-screen view always has an svg to draw on; it reaches the
     slide only once it holds a drawing */
  function ensureSvg(frame) {
    var svg = svgOf(frame);
    if (svg) return svg;
    var img = frame.querySelector('img');
    var r = LB.source().getBoundingClientRect();
    svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'drawings');
    svg.setAttribute('viewBox', '0 0 ' + WIDTH + ' ' + Math.round(WIDTH * r.height / r.width));
    svg.setAttribute('aria-hidden', 'true');
    img.after(svg);
    return svg;
  }

  function point(svg, e) {
    var p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    var q = p.matrixTransform(svg.getScreenCTM().inverse());
    return { x: q.x, y: q.y };
  }

  function newGroup(svg, kind) {
    var g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'dw');
    g.setAttribute('data-kind', kind);
    svg.appendChild(g);
    return g;
  }
  function paintGroup(g, label) {
    var a = JSON.parse(g.dataset.a), b = JSON.parse(g.dataset.b);
    g.innerHTML = shapeMarkup(g.getAttribute('data-kind'), a, b, label, RTL,
                              g.ownerSVGElement.viewBox.baseVal.height);
  }
  function labelOf(g) { var t = g.querySelector('text'); return t ? t.textContent : ''; }

  /* the corners/ends of a drawing read back from its markup, so one made by
     deck_draw.py or saved earlier can be relabelled the same way */
  function endsOf(g) {
    var r = g.querySelector('rect'), poly = g.querySelector('polygon'), l = g.querySelector('line');
    if (r) {
      var x = +r.getAttribute('x'), y = +r.getAttribute('y');
      return [{ x: x, y: y }, { x: x + +r.getAttribute('width'), y: y + +r.getAttribute('height') }];
    }
    var tip = poly.getAttribute('points').split(' ').map(Number);
    return [{ x: +l.getAttribute('x1'), y: +l.getAttribute('y1') }, { x: tip[0], y: tip[1] }];
  }

  /* ---------- write the copy back to the slide ---------- */
  function syncBack() {
    var img = LB.source(), frame = LB.frame(), svg = svgOf(frame);
    var onSlide = img.closest('.drawn-on');
    var has = svg && svg.querySelector('g.dw');
    if (!has) {
      if (onSlide) { onSlide.before(img); onSlide.remove(); }      /* back to a bare <img> */
    } else {
      if (!onSlide) {
        onSlide = document.createElement('span');
        onSlide.className = 'drawn-on';
        img.before(onSlide);
        onSlide.appendChild(img);
      }
      var clean = svg.cloneNode(true);
      clean.querySelectorAll('g.dw').forEach(function (g) {
        g.classList.remove('dw-sel');
        g.removeAttribute('data-a');
        g.removeAttribute('data-b');
      });
      var old = svgOf(onSlide);
      if (old) old.replaceWith(clean); else onSlide.appendChild(clean);
    }
    E.drawingsChanged();
    countAll();
  }

  /* ---------- the tool row in the full-screen view ---------- */
  var tool = null, selected = null, drag = null, labelBox = null;

  function button(cls, text, title, fn) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = text; b.title = title;
    b.onclick = fn;
    return b;
  }
  function setTool(t) {
    tool = tool === t ? null : t;
    LB.tools().querySelectorAll('.t-kind').forEach(function (b) {
      b.classList.toggle('on', b.dataset.kind === tool);
    });
    document.getElementById('lightbox').classList.toggle('tool-on', !!tool);
    select(null);
  }
  function select(g) {
    if (selected) selected.classList.remove('dw-sel');
    selected = g;
    if (g) g.classList.add('dw-sel');
  }
  function removeSelected() {
    if (!selected) { E.flash(say('לא נבחר סימון — לחצו על סימון ואז מחקו', 'No drawing selected — click one, then delete'), true); return; }
    selected.remove();
    selected = null;
    syncBack();
  }

  LB.onOpen(function () {
    var row = LB.tools();
    row.innerHTML = '';
    var box = button('t-kind', say('▭ מלבן', '▭ box'), say('גררו על התמונה כדי לסמן אזור', 'Drag on the picture to mark an area'), function () { setTool('box'); });
    box.dataset.kind = 'box';
    var arrow = button('t-kind', say('↗ חץ', '↗ arrow'),
                       say('גררו מהמקום שהחץ יוצא ממנו אל המקום שהוא מצביע עליו',
                           'Drag from where the arrow starts to where it points'),
                       function () { setTool('arrow'); });
    arrow.dataset.kind = 'arrow';
    row.appendChild(box);
    row.appendChild(arrow);
    row.appendChild(button('t-del', say('מחק סימון', 'delete drawing'),
                              say('מוחק את הסימון שנבחר (Delete)', 'Deletes the selected drawing (Delete)'), removeSelected));
    row.appendChild(button('t-clr', say('נקה תמונה', 'clear picture'),
                              say('מוחק את כל הסימונים בתמונה הזאת', 'Deletes every drawing on this picture'), function () {
      var svg = svgOf(LB.frame());
      var n = svg ? svg.querySelectorAll('g.dw').length : 0;
      if (!n) { E.flash(say('אין סימונים בתמונה הזאת', 'No drawings on this picture'), true); return; }
      if (!confirm(say('למחוק ' + n + ' סימונים מהתמונה הזאת?', 'Delete ' + n + ' drawings from this picture?'))) return;
      svg.querySelectorAll('g.dw').forEach(function (g) { g.remove(); });
      selected = null;
      syncBack();
    }));
    var hint = document.createElement('span');
    hint.className = 't-hint';
    hint.textContent = say('בחרו כלי וגררו על התמונה · לחיצה על סימון בוחרת אותו · לחיצה כפולה משנה את הכיתוב',
                           'Pick a tool and drag on the picture · a click selects a drawing · a double click changes its label');
    row.appendChild(hint);
    tool = null; selected = null;
    document.getElementById('lightbox').classList.remove('tool-on');

    var frame = LB.frame();
    frame.addEventListener('pointerdown', down);
    frame.addEventListener('dblclick', relabel);
  });
  LB.onClose(function () {
    if (labelBox) labelBox.commit();
    tool = null; selected = null; drag = null;
  });

  function down(e) {
    if (labelBox) return;
    var g = e.target.closest && e.target.closest('g.dw');
    if (!tool) { select(g || null); return; }
    e.preventDefault();
    var svg = ensureSvg(LB.frame());
    var p = point(svg, e);
    drag = { kind: tool, svg: svg, a: p, g: newGroup(svg, tool) };
    LB.frame().setPointerCapture(e.pointerId);
    LB.frame().addEventListener('pointermove', move);
    LB.frame().addEventListener('pointerup', up, { once: true });
  }
  function move(e) {
    if (!drag) return;
    var b = point(drag.svg, e);
    drag.g.dataset.a = JSON.stringify(drag.a);
    drag.g.dataset.b = JSON.stringify(b);
    paintGroup(drag.g, '');
  }
  function up(e) {
    LB.frame().removeEventListener('pointermove', move);
    if (!drag) return;
    var d = drag; drag = null;
    var b = point(d.svg, e);
    if (Math.abs(b.x - d.a.x) < SMALLEST && Math.abs(b.y - d.a.y) < SMALLEST) {
      d.g.remove();
      E.flash(say('הסימון קטן מדי — גררו על התמונה כדי לצייר', 'Too small to draw — drag across the picture'), true);
      return;
    }
    d.g.dataset.a = JSON.stringify(d.a);
    d.g.dataset.b = JSON.stringify(b);
    paintGroup(d.g, '');
    askLabel(d.g, e.clientX, e.clientY, '');
  }

  function relabel(e) {
    var g = e.target.closest && e.target.closest('g.dw');
    if (!g || tool) return;
    var ends = endsOf(g);
    g.dataset.a = JSON.stringify(ends[0]);
    g.dataset.b = JSON.stringify(ends[1]);
    select(g);
    askLabel(g, e.clientX, e.clientY, labelOf(g));
  }

  /* the label is typed in place; Enter or a click elsewhere keeps it, Esc keeps the
     drawing without a label. An empty label is allowed -- a box alone says "here". */
  function askLabel(g, cx, cy, now) {
    var input = document.createElement('input');
    input.className = 'lb-label';
    input.value = now;
    input.placeholder = say('כיתוב (לא חובה) · Enter', 'label (optional) · Enter');
    input.dir = 'auto';
    input.style.left = cx + 'px';
    input.style.top = cy + 'px';
    document.getElementById('lightbox').appendChild(input);
    var done = false;
    labelBox = {
      commit: function () {
        if (done) return;
        done = true;
        labelBox = null;
        paintGroup(g, input.value.trim());
        input.remove();
        syncBack();
      }
    };
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { labelBox && labelBox.commit(); }
      if (e.key === 'Escape') { e.preventDefault(); input.value = ''; labelBox && labelBox.commit(); }
    });
    input.addEventListener('blur', function () { if (labelBox) labelBox.commit(); });
    setTimeout(function () { input.focus(); }, 0);
  }

  document.addEventListener('keydown', function (e) {
    if (!LB.isOpen() || labelBox) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      e.preventDefault();
      removeSelected();
    }
  });

  /* ---------- clear every drawing in the deck ---------- */
  var clearAll = document.createElement('button');
  clearAll.id = 'btn-draw-clr';
  clearAll.type = 'button';
  clearAll.dataset.chrome = '1';
  clearAll.title = say('מוחק את כל הסימונים מכל התמונות במצגת (נשמר רק בלחיצה על ״שמור״)',
                         'Deletes every drawing on every picture in the deck (written only when you press save)');
  clearAll.onclick = function () {
    var n = document.querySelectorAll('.slide svg.drawings g.dw').length;
    if (!confirm(say('למחוק את כל ' + n + ' הסימונים מכל התמונות במצגת?',
                     'Delete all ' + n + ' drawings from every picture in the deck?'))) return;
    document.querySelectorAll('.slide .drawn-on').forEach(function (w) {
      var img = w.querySelector('img');
      w.before(img);
      w.remove();
    });
    if (LB.isOpen()) LB.refresh();
    E.drawingsChanged();
    countAll();
    E.flash(n + say(' סימונים נמחקו — לחצו ״שמור״ כדי לכתוב לקובץ', ' drawings deleted — press save to write the file'), true);
  };
  function countAll() {
    var n = document.querySelectorAll('.slide svg.drawings g.dw').length;
    clearAll.textContent = say('נקה ציורים · ', 'clear drawings · ') + n;
    clearAll.style.display = n ? '' : 'none';
  }
  document.querySelector('#bar .spacer').before(clearAll);
  countAll();

  window.deckDraw = { shapeMarkup: shapeMarkup, WIDTH: WIDTH, COLOR: COLOR };
})();
