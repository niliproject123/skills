/* Direct-edit layer.
   Every line of text on a slide is editable in place. Saving posts the whole
   document back and the server writes it over the deck's own file, so the file
   is always the current state -- there is no side store to fall out of sync.

   Remarks are written inline, prefixed "michael:", and highlighted so they are
   easy to spot on screen and easy to grep out of the file afterwards.

   The editing chrome (contenteditable, data-* ids, undo buttons) is injected at
   load and STRIPPED before saving, so it never accumulates in the file. */
(function () {
  /* the folder is part of the name: a deck in the archive saves to the archive */
  var DOC = location.pathname.replace(/^\/+/, '') || 'deck.html';
  var API = '/api/deck?doc=' + encodeURIComponent(DOC);
  /* the reader writes the marker in either language; both must highlight and count */
  var MARK = /(michael|מיכאל)\s*:/i;

  /* A deck whose whole content IS the remarks -- the questions deck, where every row
     is a comment and one column is the reader's own -- has nothing to jump between,
     so the three-button trail is noise there.  Such a deck sets data-notes="off" on
     <body>.  Everything else about remarks still works: they are still highlighted,
     still counted, still listed in the drawer. */
  var NOTE_TRAIL = document.body.dataset.notes !== 'off';
  var PLAIN = 'plaintext-only';

  /* leaf text nodes only - editing a container would break its structure */
  var TARGETS = [
    '.cover h1', '.cover .sub', '.cover .strip', '.cover .foot span',
    'h1.title', 'p.kicker', '.viewkind .vt',
    '.panel h3', '.panel li',
    '.card .h', '.card .d', '.card li',
    '.step .h', '.step .d', '.trio .cell .k', '.trio .cell .v',
    '.note', '.blocks .b', 'table.grid th', 'table.grid td',
    /* the slide-type layouts: every leaf that carries words is editable too */
    '.facts .g', '.facts .f .k', '.facts .f .v', '.facts .b',
    '.flds .fl h4', '.flds .fl li', '.acts .ac h4', '.acts .ac li',
    '.mock-t .mt', '.mock-t .cap', '.mock-cap', 'table.mini th', 'table.mini td',
    '.chip', '.tree div', '.form .lb', '.form .in',
    '.kpi .n', '.kpi .t', '.kpi .s',
    '.rules .r .h', '.rules .r .d', '.rail .st .h', '.rail .st .d',
    '.moves .src .h', '.moves .src .d', '.moves .dst .t',
    '.sect', '.chips .lb', '.index-grid a .t', '.pcard .nums span',
    '.qlist .q .t', '.qlist .q .a', '.side > h3', '.side li', '.divider',
    '.pcard .ttl', '.pcard .meta', '.col > .ch', '.bcard .bt', '.bcard .bm',
    '.who .p .nm', '.who .p .rl',
    '.reply .rt'
  ].join(',');

  /* never armed: the corner badge, the contents (deck_nav.py rewrites it), chrome, and
     anything the author marked data-fixed */
  var FIXED = '.slide-no, .toc, [data-fixed], [data-chrome], script, style, svg, button, .undo-btn';
  function ownWords(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3 && c.nodeValue.trim()) return true;
    }
    return false;
  }

  var dirty = false;
  var drawingsUnsaved = false;     /* set by draw.js through deckEdit.drawingsChanged */

  function txt(el) {
    /* The undo button lives inside the element it undoes, so its glyph must never
       count as content - otherwise a saved line reads as modified the moment its
       button appears, and the page claims unsaved changes forever. */
    if (!el.querySelector('.undo-btn')) {
      return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    }
    var c = el.cloneNode(true);
    c.querySelectorAll('.undo-btn').forEach(function (b) { b.remove(); });
    return (c.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function flash(msg, bad) {
    var s = document.getElementById('status');
    s.textContent = msg;
    s.style.color = bad ? '#FFB4B4' : '#9FE8C9';
  }

  /* ---------- arm every editable line ---------- */
  document.querySelectorAll('.slide').forEach(function (slide) {
    var n = 0;
    slide.querySelectorAll(TARGETS).forEach(function (el) {
      n += 1;
      el.dataset.edit = 's' + slide.dataset.no + '-' + (n < 10 ? '0' + n : n);
      el.dataset.orig = txt(el);
      el.setAttribute('contenteditable', PLAIN);
      if (el.contentEditable !== PLAIN) {        // engines that ignore the value
        el.setAttribute('contenteditable', 'true');
        el.dataset.richPaste = '1';
      }
      el.setAttribute('spellcheck', 'false');
      paint(el);
    });
    /* Any other line of words on the slide is editable too. TARGETS names the layouts of
       deck.css; a deck that adds its own classes used to get no editable line at all, and
       nothing said so. These are numbered in a series of their own (s05-x01), so the ids
       TARGETS gives -- the ones changes.json already holds -- do not move. A line meant
       to stay fixed carries data-fixed; deck_check.py's edit check reads the same rule. */
    var x = 0;
    slide.querySelectorAll('*').forEach(function (el) {
      if (!ownWords(el) || el.closest(FIXED) || el.closest('[data-edit]')
          || el.querySelector('[data-edit]')) return;
      x += 1;
      el.dataset.edit = 's' + slide.dataset.no + '-x' + (x < 10 ? '0' + x : x);
      el.dataset.orig = txt(el);
      el.setAttribute('contenteditable', PLAIN);
      if (el.contentEditable !== PLAIN) {
        el.setAttribute('contenteditable', 'true');
        el.dataset.richPaste = '1';
      }
      el.setAttribute('spellcheck', 'false');
      paint(el);
    });
  });

  /* A deck may carry panels that sit OUTSIDE the slide -- the database layer is one,
     kept out so the slide keeps its printed shape. The loop above never reaches them,
     so their prose lines are armed here by the same rules: a remark on a query is
     written the same way as a remark on a slide, and counts the same. Decks without
     such panels arm nothing here. */
  document.querySelectorAll('.qz').forEach(function (panel) {
    var n = 0;
    panel.querySelectorAll('.qz-p').forEach(function (el) {
      n += 1;
      el.dataset.edit = 'q' + panel.dataset.qz + '-' + (n < 10 ? '0' + n : n);
      el.dataset.orig = txt(el);
      el.setAttribute('contenteditable', PLAIN);
      if (el.contentEditable !== PLAIN) {
        el.setAttribute('contenteditable', 'true');
        el.dataset.richPaste = '1';
      }
      el.setAttribute('spellcheck', 'false');
      paint(el);
    });
  });

  if (document.querySelector('[data-rich-paste]')) {
    document.addEventListener('paste', function (e) {
      var el = e.target.closest && e.target.closest('[data-edit]');
      if (!el) return;
      e.preventDefault();
      document.execCommand('insertText', false,
        (e.clipboardData || window.clipboardData).getData('text'));
    });
  }

  function changed(el) { return txt(el) !== el.dataset.orig; }

  /* Emptying a line IS the remark -- the reader should not have to also type a marker
     to say "take this out". The text they removed is kept on the element so the slide
     still reads, so they can put it back, and so it can be grepped out of the file. */
  function cut(el) {
    var now = txt(el);
    if (now === '' && el.dataset.orig) el.setAttribute('data-cut', el.dataset.orig);
    else if (now !== '') el.removeAttribute('data-cut');
    return el.hasAttribute('data-cut');
  }
  function hasNote(el) { return MARK.test(txt(el)) || el.hasAttribute('data-cut'); }

  function paint(el) {
    var c = changed(el);
    cut(el);
    el.classList.toggle('edited', c);
    el.classList.toggle('has-note', hasNote(el));
    var btn = el.querySelector(':scope > .undo-btn');
    if (c && !btn) {
      btn = document.createElement('button');
      btn.className = 'undo-btn';
      btn.type = 'button';
      btn.contentEditable = 'false';
      btn.title = 'החזר לנוסח שהיה בפתיחת העמוד';
      btn.textContent = '↺';
      btn.onclick = function (e) {
        e.stopPropagation();
        el.textContent = el.dataset.orig;
        paint(el);
        recount();
      };
      el.appendChild(btn);
    } else if (!c && btn) {
      btn.remove();
    }
  }

  function stats() {
    var ch = 0, nt = 0;
    document.querySelectorAll('[data-edit]').forEach(function (el) {
      if (changed(el)) ch += 1;
      if (hasNote(el)) nt += 1;
    });
    return { changed: ch, notes: nt };
  }

  function recount() {
    var s = stats();
    document.getElementById('cnt').textContent = s.changed;
    document.getElementById('notes').textContent = s.notes;
    /* the remark trail is whatever the reader has typed so far, so its length moves
       under the nav button while they work */
    if (window.__noteNavSync) window.__noteNavSync();
    dirty = s.changed > 0 || drawingsUnsaved;
    if (dirty) flash('יש שינויים שלא נשמרו — לחצו ״שמור״', true);
  }

  document.addEventListener('input', function (e) {
    var el = e.target.closest && e.target.closest('[data-edit]');
    if (!el) return;
    paint(el);
    recount();
  });

  /* ---------- serialise a clean copy and save ---------- */
  /* Password managers and similar extensions add their own markup to the live page.
     None of it belongs in the deck file, so it comes out before the save -- and the
     count is reported, because an extension that keeps writing must stay visible. */
  var pulled = [];
  function pullExtensions(doc) {
    var found = [];
    [].slice.call(doc.querySelectorAll('*')).forEach(function (el) {
      var tag = el.tagName.toLowerCase();
      var body = (tag === 'style' || tag === 'script') ? el.textContent : '';
      var url = el.getAttribute('href') || el.getAttribute('src') || '';
      var named = el.getAttribute('name') || '';
      if (tag.indexOf('-') !== -1 ||            /* custom element; the deck has none */
          el.hasAttribute('aria-live') ||       /* announcement box; the deck sets none */
          /-extension:\/\//.test(body) || /-extension:\/\//.test(url) ||
          /nordpass|lastpass|1password|bitwarden|grammarly/i.test(named)) {
        found.push(tag);
        el.remove();
      }
    });
    return found;
  }

  function cleanHTML() {
    var doc = document.documentElement.cloneNode(true);
    pulled = pullExtensions(doc);
    doc.querySelectorAll('.undo-btn, #btn-seen, #btn-seen-clr, #chg, [data-chrome]')
      .forEach(function (b) { b.remove(); });
    doc.querySelectorAll('[data-mark]').forEach(function (el) {
      el.removeAttribute('data-mark');            // navigation scaffolding, not content
    });
    // mark-flash is the outline the jump-to-mark draws. It was cleared only off
    // elements that still carried data-mark, so a flash left on a <section
    // data-updated> survived "נקרא" -- that handler strips data-mark first, and
    // the sweep above then no longer sees the element. The save aborted on a
    // deck the reader had merely scrolled through. It is runtime highlight and
    // never belongs in the file, so clear it everywhere.
    doc.querySelectorAll('.mark-flash').forEach(function (el) {
      el.classList.remove('mark-flash');
      if (!el.classList.length) el.removeAttribute('class');
    });
    /* nav.js marks the slide list's link for the slide in view. Which one depends on where
       the reader had scrolled, so it was saved into the file, and after a reload two
       links stayed lit: the saved one and the one nav.js marked. */
    doc.querySelectorAll('#slidebar a.here').forEach(function (el) {
      el.classList.remove('here');
    });
    doc.querySelectorAll('[class=""]').forEach(function (el) {
      el.removeAttribute('class');
    });
    doc.querySelectorAll('[data-edit]').forEach(function (el) {
      el.removeAttribute('data-edit');
      el.removeAttribute('data-orig');
      el.removeAttribute('data-rich-paste');
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
      el.classList.remove('edited', 'has-note');   // runtime highlights, not content
      if (!el.classList.length) el.removeAttribute('class');
    });
    var bar = doc.querySelector('#status');
    if (bar) { bar.textContent = 'טוען…'; bar.removeAttribute('style'); }
    var c = doc.querySelector('#cnt'), n = doc.querySelector('#notes');
    if (c) c.textContent = '0';
    if (n) n.textContent = '0';
    var d = doc.querySelector('#drawer');
    if (d) { d.innerHTML = ''; d.removeAttribute('class'); }
    doc.querySelectorAll('.slide').forEach(function (s) {
      s.style.removeProperty('zoom');              // fit.js measured this window, not the deck
      if (!s.getAttribute('style')) s.removeAttribute('style');
    });
    return '<!doctype html>\n' + doc.outerHTML + '\n';
  }

  function save() {
    var html = cleanHTML();
    var leak = ['data-edit=', 'data-orig=', 'contenteditable', 'undo-btn',
                'has-note', 'class="edited', 'id="status" style',
                'id="btn-seen"', 'data-mark=', 'mark-flash',
                'id="chg"', 'data-chrome', '-extension://', 'nordpass',
                'zoom:'].filter(function (s) {
      return html.indexOf(s) !== -1;
    });
    if (leak.length) {
      alert('השמירה בוטלה: סימוני העריכה לא נוקו מהקובץ (' + leak.join(', ') + ').\n' +
            'דווחו על כך — הקובץ לא נשמר.');
      flash('השמירה בוטלה — נותרו סימוני עריכה: ' + leak.join(', '), true);
      return;
    }
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/html; charset=utf-8' },
                 body: html })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || res.j.error) throw new Error(res.j.error || 'HTTP error');
        document.querySelectorAll('[data-edit]').forEach(function (el) {
          el.dataset.orig = txt(el);            // saved text is the new baseline
          paint(el);
        });
        dirty = false;
        drawingsUnsaved = false;
        recount();
        flash('נשמר אל ' + res.j.file + ' · ' + res.j.notes + ' הערות בקובץ · ' +
              'גיבוי ' + res.j.backups +
              (pulled.length ? ' · הוסרו ' + pulled.length +
               ' רכיבים שתוסף דפדפן הוסיף לדף (' + pulled.join(', ') + ')' : ''), false);
      })
      .catch(function (e) {
        flash('השמירה נכשלה: ' + e.message, true);
        alert('השמירה נכשלה, והקובץ לא עודכן.\n\n' + e.message +
              '\n\nודאו שהשרת רץ ונסו שוב. הטקסט נשאר על המסך.');
      });
  }


  document.getElementById('btn-save').onclick = save;
  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
  });

  var s0 = stats();
  var cuts = document.querySelectorAll('[data-cut]').length;
  document.getElementById('cnt').textContent = 0;
  document.getElementById('notes').textContent = s0.notes;
  var msg = [];
  if (s0.notes - cuts > 0) msg.push((s0.notes - cuts) + ' הערות בקובץ');
  if (cuts) msg.push(cuts + ' שורות שסומנו למחיקה');
  flash(msg.length ? msg.join(' · ') + ' · Ctrl+S לשמירה'
                   : 'מוכן · לחצו על כל שורה כדי לערוך · Ctrl+S לשמירה', false);

  /* ---------- what the sibling files share ---------- */
  /* The drawer, the two trails, the full-screen view and the drawings live in files of
     their own (edit_changes.js, lightbox.js, draw.js). They work on the same page state,
     so the pieces they need are handed over here rather than duplicated. A drawing is not
     a line of text, so stats() cannot see it: draw.js reports its unsaved work through
     drawingsChanged(), and save() clears it. */
  window.deckEdit = {
    DOC: DOC, NOTE_TRAIL: NOTE_TRAIL, MARK: MARK,
    txt: txt, changed: changed, hasNote: hasNote, paint: paint,
    recount: recount, flash: flash, save: save,
    drawingsChanged: function () { drawingsUnsaved = true; recount(); }
  };

  /* Loaded from here, not from the deck's own <script> tags, so a deck written before
     these files existed gets them too. The tags carry data-chrome, so cleanHTML takes
     them out again before a save. A file that fails to load is said on the status bar:
     the deck still edits, but the reader must know a part of the page is missing. */
  var HERE = document.currentScript.src.replace(/edit\.js(\?.*)?$/, '');
  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = HERE + 'draw.css';
  css.dataset.chrome = '1';
  document.head.appendChild(css);
  ['edit_changes.js', 'lightbox.js', 'draw.js'].forEach(function (name) {
    var s = document.createElement('script');
    s.src = HERE + name;
    s.async = false;                     /* run in this order: draw.js uses lightbox.js */
    s.dataset.chrome = '1';
    s.onerror = function () {
      flash('הקובץ ' + name + ' לא נטען — חלק מכלי העריכה חסר בדף', true);
    };
    document.head.appendChild(s);
  });
})();
