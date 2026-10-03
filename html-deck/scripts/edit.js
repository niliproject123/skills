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

  var dirty = false;

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
    dirty = s.changed > 0;
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

  /* ---------- list of this session's changes ---------- */
  var drawer = document.getElementById('drawer');
  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /* A remark can sit on a slide or on a panel that follows one. Both report the same
     heading, so the drawer stays one list rather than two. Without this, a line outside
     a slide has no .slide to close on and the drawer throws instead of listing it. */
  function place(el) {
    var s = el.closest('.slide');
    if (s) return { no: s.dataset.no, name: s.dataset.name };
    var q = el.closest('.qz');
    if (q) {
      var t = q.querySelector('.qz-ttl');
      return { no: q.dataset.qz, name: (t ? t.textContent : '') + ' — מסד נתונים' };
    }
    return { no: '—', name: '' };
  }

  function render() {
    var rows = [];
    var vis = seen();
    var mine = marks.map(function (el, i) {
      var s = el.closest('.slide'), c = vis[i];
      var what = el.hasAttribute('data-updated')
        ? el.getAttribute('data-updated') + ' — כל השקופית'
        : txt(el).slice(0, 110) || 'ללא טקסט';
      return '<div class="item mine" data-mark="' + el.dataset.mark + '"><div class="w">' +
        s.dataset.no + ' · ' + esc(s.dataset.name) + ' <b class="up-lbl">עודכן</b></div>' +
        (c ? '<div class="ask"><b>ביקשת:</b> ' + esc(c.ask) + '</div>' +
             '<div class="was">' + esc(c.was) + '</div>' : '') +
        '<div class="now">' + esc(what) + '</div></div>';
    }).join('');
    /* a line that was taken out has no element left to point at, so it is listed only */
    mine += CH.filter(function (c) { return c.removed; }).map(function (c) {
      return '<div class="item mine gone"><div class="w">' + esc(c.slide) +
        ' <b class="up-lbl">הוסר</b></div>' +
        '<div class="ask"><b>ביקשת:</b> ' + esc(c.ask) + '</div>' +
        '<div class="was">' + esc(c.was) + '</div>' +
        '<div class="now">' + esc(c.note || '') + '</div></div>';
    }).join('');
    document.querySelectorAll('[data-edit]').forEach(function (el) {
      if (changed(el) || hasNote(el)) rows.push(el);
    });
    var h = '<h2>מה שיניתי</h2><div class="where">נשמר אל <code>' + esc(DOC) +
            '</code> · הערות מסומנות ב-<code>michael:</code> או <code>מיכאל:</code>' +
            ' · שורה שרוקנתם נספרת כבקשת מחיקה</div>';
    if (mine) h += '<h3 class="grp">מה שינינו מאז שקראתם — ' + marks.length + '</h3>' + mine;
    if (mine) h += '<h3 class="grp">מה שאתם שיניתם</h3>';
    if (!rows.length) {
      h += '<div class="empty">עדיין לא שיניתם דבר.<br><br>לחצו על כל שורה במצגת וכתבו ' +
           'עליה ישירות.<br><br><b>למחוק שורה</b> — פשוט רוקנו אותה. אין צורך לסמן דבר: ' +
           'הנוסח שמחקתם נשמר מסומן בקו, ואמצא אותו.<br><br><b>להעיר בלי לתקן נוסח</b> — ' +
           'התחילו את ההערה במילה <code>מיכאל:</code> והיא תודגש.</div>';
    }
    rows.forEach(function (el) {
      var s = place(el), gone = el.hasAttribute('data-cut');
      var label = gone ? ' <b class="cut-lbl">נמחק</b>' : (hasNote(el) ? ' <b>הערה</b>' : '');
      h += '<div class="item' + (gone ? ' cut-row' : hasNote(el) ? ' note-row' : '') +
        '" data-go="' + el.dataset.edit + '"><div class="w">' + s.no + ' · ' +
        esc(s.name) + label + '</div>' +
        (changed(el) || gone ? '<div class="was">' +
          esc(gone ? el.getAttribute('data-cut') : el.dataset.orig) + '</div>' : '') +
        (gone ? '' : '<div class="now">' + esc(txt(el)) + '</div>') + '</div>';
    });
    drawer.innerHTML = h;
    drawer.querySelectorAll('.item').forEach(function (it) {
      it.onclick = function () {
        if (it.dataset.mark) {
          var m = document.querySelector('[data-mark="' + it.dataset.mark + '"]');
          if (m) goToMark(marks.indexOf(m));
          return;
        }
        var t = document.querySelector('[data-edit="' + it.dataset.go + '"]');
        if (!t) return;
        /* the panel may be switched off; scrolling to something hidden lands nowhere */
        if (t.closest('.qz') && window.qzReveal) window.qzReveal();
        t.scrollIntoView({ behavior: 'smooth', block: 'center' });
        t.focus();
      };
    });
  }

  document.getElementById('btn-list').onclick = function () {
    drawer.classList.toggle('open');
    if (drawer.classList.contains('open')) render();
  };
  document.getElementById('btn-save').onclick = save;
  document.getElementById('btn-clr').onclick = function () {
    if (!confirm('להחזיר את כל השינויים שנעשו מאז פתיחת העמוד?')) return;
    document.querySelectorAll('[data-edit]').forEach(function (el) {
      if (changed(el)) { el.textContent = el.dataset.orig; paint(el); }
    });
    recount();
    render();
  };
  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
  });

  /* ---------- what I changed since they last read the deck ---------- */
  /* Marked green in the file itself, not injected, so the marks survive a reload and
     a handover. A counter alone is useless -- "9 changed" does not tell them WHERE --
     so the button walks them through the marks one at a time, and the drawer lists
     them. Clearing is a separate button, because it is a separate decision. */
  function marked() {
    return document.querySelectorAll('.updated, .slide[data-updated]');
  }
  var marks = [].slice.call(marked());
  marks.forEach(function (el, i) { el.dataset.mark = 'm' + (i + 1); });
  var at = -1;

  /* A green outline says THAT something changed; it cannot say what it replaced or
     which remark asked for it. That record lives in changes.json beside the deck --
     kept out of the deck file so the reader's own copy keeps its shape. */
  var CH = [];
  function seen() { return CH.filter(function (c) { return !c.removed; }); }

  fetch('changes.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (j) {
      CH = j[DOC] || [];
      if (seen().length !== marks.length) {
        flash('רשומת השינויים אינה תואמת את הסימונים (' + seen().length + ' מול ' +
              marks.length + ') — ״ביקשת״ ו״היה״ עלולים להצביע על המקום הלא נכון', true);
        CH = [];
        return;
      }
      if (drawer.classList.contains('open')) render();
    })
    .catch(function (e) {
      flash('רשומת השינויים לא נטענה (' + e.message + ') — הסימונים עובדים, ' +
            'אך בלי ״ביקשת״ ו״היה״', true);
    });

  /* One card, two callers: what I changed, and what the reader wrote. A second panel
     would be a second thing to strip before saving and a second entry in the leak list,
     so both render into #chg. */
  var panel;
  function card(head, body) {
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'chg';
      document.body.appendChild(panel);
    }
    panel.innerHTML = '<button class="x" type="button">\u00d7</button>' +
      '<div class="hd">' + head + '</div>' + body;
    panel.classList.add('on');
    panel.querySelector('.x').onclick = function () { panel.classList.remove('on'); };
  }

  /* the card that answers "what did I ask for, and what did it say before" */
  function showRecord(i) {
    var c = seen()[i];
    if (!c) {
      card('אין רשומה לשינוי הזה',
           '<div class="was">changes.json לא נטען, או שאינו תואם את הסימונים.</div>');
      return;
    }
    card(esc(c.slide),
      '<div class="k">ביקשת</div><div class="ask">' + esc(c.ask) + '</div>' +
      '<div class="k">היה כתוב</div><div class="was">' + esc(c.was) + '</div>' +
      '<div class="k">עכשיו</div><div class="now">הטקסט המסומן בירוק בשקופית</div>');
  }

  function goToMark(i) {
    if (!marks.length) return;
    at = (i + marks.length) % marks.length;
    var el = marks[at];
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    marks.forEach(function (m) { m.classList.remove('mark-flash'); });
    el.classList.add('mark-flash');
    nav.textContent = 'עודכן ' + (at + 1) + ' מתוך ' + marks.length;
    nav.title = 'המקום הבא ששיניתי';
    showRecord(at);
  }

  var nav;
  if (marks.length) {
    nav = document.createElement('button');
    nav.id = 'btn-seen';
    nav.type = 'button';
    nav.textContent = 'עודכן: ' + marks.length;
    nav.title = 'מעבר למקום הראשון ששיניתי';
    nav.onclick = function () { goToMark(at + 1); };

    /* forward-only meant that overshooting cost a lap of the whole deck */
    var prev = document.createElement('button');
    prev.id = 'btn-seen-prev';
    prev.type = 'button';
    prev.dataset.chrome = '1';
    prev.className = 'step';
    prev.textContent = '\u2039';
    prev.title = 'המקום הקודם ששיניתי';
    prev.onclick = function () { goToMark(at - 1); };

    var next = document.createElement('button');
    next.id = 'btn-seen-next';
    next.type = 'button';
    next.dataset.chrome = '1';
    next.className = 'step';
    next.textContent = '\u203a';
    next.title = 'המקום הבא ששיניתי';
    next.onclick = function () { goToMark(at + 1); };

    var clr = document.createElement('button');
    clr.id = 'btn-seen-clr';
    clr.type = 'button';
    clr.textContent = 'נקרא';
    clr.title = 'מסיר את הסימון הירוק מכל מה שעודכן, ושומר';
    clr.onclick = function () {
      if (!confirm('להסיר את סימוני העדכון מ-' + marked().length + ' מקומות ולשמור?')) return;
      document.querySelectorAll('.updated').forEach(function (el) {
        el.classList.remove('updated', 'mark-flash');
        if (!el.classList.length) el.removeAttribute('class');
      });
      document.querySelectorAll('.slide[data-updated]').forEach(function (el) {
        el.removeAttribute('data-updated');
      });
      marks.forEach(function (el) { el.removeAttribute('data-mark'); });
      marks = [];
      if (panel) panel.classList.remove('on');
      prev.remove();
      nav.remove();
      next.remove();
      clr.remove();
      save();
    };
    var sp = document.querySelector('#bar .spacer');
    sp.before(prev);
    sp.before(nav);
    sp.before(next);
    sp.before(clr);
  }

  /* ---------- the reader's own remarks, walked the same way ---------- */
  /* A remark is a line the reader typed "מיכאל:" into, or one they emptied. Both are
     painted in place, and until now that was the whole story: on a deck this long a
     remark five slides back was found by scrolling. Rebuilt on every call, because
     unlike the green marks this list changes while the page is open. */
  function noteList() {
    return [].slice.call(document.querySelectorAll('[data-edit]'))
      .filter(function (el) { return hasNote(el); });
  }
  var noteAt = -1;

  function showNote(el) {
    var p = place(el);
    var gone = el.hasAttribute('data-cut');
    var body;
    if (gone) {
      body = '<div class="k">ביקשתם</div>' +
             '<div class="ask">רוקנתם את השורה — כלומר בקשה להוריד אותה</div>' +
             '<div class="k">היה כתוב</div><div class="was">' +
             esc(el.getAttribute('data-cut')) + '</div>' +
             '<div class="k">עכשיו</div><div class="now">השורה ריקה</div>';
    } else {
      body = '<div class="k">ההערה שלכם</div><div class="ask">' + esc(txt(el)) + '</div>' +
             (changed(el)
               ? '<div class="k">היה כתוב</div><div class="was">' +
                 esc(el.dataset.orig) + '</div>'
               : '<div class="k">הנוסח לא שונה</div>' +
                 '<div class="was">ההערה נוספה לשורה, והנוסח עצמו נשאר.</div>');
    }
    card('' + p.no + ' · ' + esc(p.name) + (gone ? ' — למחיקה' : ' — הערה'), body);
  }

  function goToNote(i) {
    var list = noteList();
    if (!list.length) { syncNoteNav(); return; }
    noteAt = (i + list.length) % list.length;
    var el = list[noteAt];
    if (el.closest('.qz') && window.qzReveal) window.qzReveal();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelectorAll('.mark-flash').forEach(function (m) {
      m.classList.remove('mark-flash');
    });
    el.classList.add('mark-flash');
    syncNoteNav();
    showNote(el);
  }

  var noteNav, notePrev, noteNext;
  function syncNoteNav() {
    if (!noteNav) return;
    var n = noteList().length;
    noteNav.textContent = (n && noteAt >= 0)
      ? 'הערה ' + (noteAt + 1) + ' מתוך ' + n
      : 'דילוג להערות';
    /* a deck with no remarks yet should not carry three dead buttons; the cluster
       appears the moment the reader writes one, and recount() calls this on every
       keystroke, so it appears as they type */
    var show = n > 0 ? '' : 'none';
    notePrev.style.display = noteNav.style.display = noteNext.style.display = show;
    if (noteAt >= n) noteAt = -1;
  }
  window.__noteNavSync = syncNoteNav;

  (function buildNoteNav() {
    if (!NOTE_TRAIL) return;
    notePrev = document.createElement('button');
    notePrev.id = 'btn-note-prev';
    notePrev.type = 'button';
    notePrev.dataset.chrome = '1';
    notePrev.className = 'step note';
    notePrev.textContent = '\u2039';
    notePrev.title = 'ההערה הקודמת שלכם';
    notePrev.onclick = function () { goToNote(noteAt - 1); };

    noteNav = document.createElement('button');
    noteNav.id = 'btn-note';
    noteNav.type = 'button';
    noteNav.dataset.chrome = '1';
    noteNav.className = 'note';
    noteNav.title = 'מעבר להערה שכתבתם';
    noteNav.onclick = function () { goToNote(noteAt + 1); };

    noteNext = document.createElement('button');
    noteNext.id = 'btn-note-next';
    noteNext.type = 'button';
    noteNext.dataset.chrome = '1';
    noteNext.className = 'step note';
    noteNext.textContent = '\u203a';
    noteNext.title = 'ההערה הבאה שלכם';
    noteNext.onclick = function () { goToNote(noteAt + 1); };

    var sp = document.querySelector('#bar .spacer');
    sp.before(notePrev);
    sp.before(noteNav);
    sp.before(noteNext);
    syncNoteNav();
  })();

  /* ---------- click anything marked, and read what it is ---------- */
  /* The marks say THAT something is there; opening the card is how you find out what,
     without hunting for the row in the drawer. The click is never swallowed -- the line
     is still contenteditable and still takes the caret -- so this adds a card and takes
     nothing away. */
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('#bar') || e.target.closest('#drawer') ||
        e.target.closest('#chg') || e.target.closest('.undo-btn')) return;

    var up = e.target.closest('.updated, .slide[data-updated]');
    if (up && marks.length) {
      var i = marks.indexOf(up);
      if (i !== -1) {
        at = i;
        document.querySelectorAll('.mark-flash').forEach(function (m) {
          m.classList.remove('mark-flash');
        });
        up.classList.add('mark-flash');
        if (nav) nav.textContent = 'עודכן ' + (at + 1) + ' מתוך ' + marks.length;
        showRecord(at);
        return;
      }
    }
    var el = e.target.closest('[data-edit]');
    if (el && hasNote(el)) {
      var list = noteList();
      noteAt = list.indexOf(el);
      document.querySelectorAll('.mark-flash').forEach(function (m) {
        m.classList.remove('mark-flash');
      });
      el.classList.add('mark-flash');
      syncNoteNav();
      showNote(el);
    }
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
})();
