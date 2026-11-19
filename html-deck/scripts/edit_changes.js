/* The change list (drawer) and the two trails: what I changed since the reader last
   read the deck (green marks, changes.json), and the reader's own remarks (yellow).
   Split out of edit.js, which loads this file and hands over what it shares through
   window.deckEdit. Nothing here is saved into the deck: every button carries
   data-chrome, or is one of the ids cleanHTML strips. */
(function () {
  var E = window.deckEdit;
  var DOC = E.DOC, NOTE_TRAIL = E.NOTE_TRAIL;
  var txt = E.txt, changed = E.changed, hasNote = E.hasNote, paint = E.paint;
  var recount = E.recount, flash = E.flash, save = E.save, say = E.say;

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
      return { no: q.dataset.qz, name: (t ? t.textContent : '') + say(' — מסד נתונים', ' — database') };
    }
    return { no: '—', name: '' };
  }

  function render() {
    var rows = [];
    var vis = seen();
    var mine = marks.map(function (el, i) {
      var s = el.closest('.slide'), c = vis[i];
      var what = el.hasAttribute('data-updated')
        ? el.getAttribute('data-updated') + say(' — כל השקופית', ' — the whole slide')
        : txt(el).slice(0, 110) || say('ללא טקסט', 'no text');
      return '<div class="item mine" data-mark="' + el.dataset.mark + '"><div class="w">' +
        s.dataset.no + ' · ' + esc(s.dataset.name) + ' <b class="up-lbl">' + say('עודכן', 'updated') + '</b></div>' +
        (c ? '<div class="ask"><b>' + say('ביקשת:', 'You asked:') + '</b> ' + esc(c.ask) + '</div>' +
             '<div class="was">' + esc(c.was) + '</div>' : '') +
        '<div class="now">' + esc(what) + '</div></div>';
    }).join('');
    /* a line that was taken out has no element left to point at, so it is listed only */
    mine += CH.filter(function (c) { return c.removed; }).map(function (c) {
      return '<div class="item mine gone"><div class="w">' + esc(c.slide) +
        ' <b class="up-lbl">' + say('הוסר', 'removed') + '</b></div>' +
        '<div class="ask"><b>' + say('ביקשת:', 'You asked:') + '</b> ' + esc(c.ask) + '</div>' +
        '<div class="was">' + esc(c.was) + '</div>' +
        '<div class="now">' + esc(c.note || '') + '</div></div>';
    }).join('');
    document.querySelectorAll('[data-edit]').forEach(function (el) {
      if (changed(el) || hasNote(el)) rows.push(el);
    });
    var h = say('<h2>מה שיניתי</h2><div class="where">נשמר אל <code>' + esc(DOC) +
                '</code> · הערות מסומנות ב-<code>michael:</code> או <code>מיכאל:</code>' +
                ' · שורה שרוקנתם נספרת כבקשת מחיקה</div>',
                '<h2>What I changed</h2><div class="where">Saved to <code>' + esc(DOC) +
                '</code> · remarks start with <code>michael:</code>' +
                ' · a line you empty counts as a request to delete it</div>');
    if (mine) h += '<h3 class="grp">' + say('מה שינינו מאז שקראתם — ', 'What we changed since you read it — ') +
                   marks.length + '</h3>' + mine;
    if (mine) h += '<h3 class="grp">' + say('מה שאתם שיניתם', 'What you changed') + '</h3>';
    if (!rows.length) {
      h += say('<div class="empty">עדיין לא שיניתם דבר.<br><br>לחצו על כל שורה במצגת וכתבו ' +
               'עליה ישירות.<br><br><b>למחוק שורה</b> — פשוט רוקנו אותה. אין צורך לסמן דבר: ' +
               'הנוסח שמחקתם נשמר מסומן בקו, ואמצא אותו.<br><br><b>להעיר בלי לתקן נוסח</b> — ' +
               'התחילו את ההערה במילה <code>מיכאל:</code> והיא תודגש.</div>',
               '<div class="empty">You have not changed anything yet.<br><br>Click any line in the deck ' +
               'and write on it directly.<br><br><b>To delete a line</b> — just empty it. Nothing else ' +
               'to mark: the wording you deleted is kept struck through, and I will find it.<br><br>' +
               '<b>To remark without changing the wording</b> — start the remark with ' +
               '<code>michael:</code> and it is highlighted.</div>');
    }
    rows.forEach(function (el) {
      var s = place(el), gone = el.hasAttribute('data-cut');
      var label = gone ? ' <b class="cut-lbl">' + say('נמחק', 'deleted') + '</b>'
                       : (hasNote(el) ? ' <b>' + say('הערה', 'remark') + '</b>' : '');
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
  document.getElementById('btn-clr').onclick = function () {
    if (!confirm(say('להחזיר את כל השינויים שנעשו מאז פתיחת העמוד?',
                     'Undo every change made since the page opened?'))) return;
    document.querySelectorAll('[data-edit]').forEach(function (el) {
      if (changed(el)) { el.textContent = el.dataset.orig; paint(el); }
    });
    recount();
    render();
  };

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
        flash(say('רשומת השינויים אינה תואמת את הסימונים (', 'changes.json does not match the marks (') +
              seen().length + say(' מול ', ' vs ') + marks.length +
              say(') — ״ביקשת״ ו״היה״ עלולים להצביע על המקום הלא נכון',
                  ') — "You asked" and "Was" could point at the wrong place'), true);
        CH = [];
        return;
      }
      if (drawer.classList.contains('open')) render();
    })
    .catch(function (e) {
      flash(say('רשומת השינויים לא נטענה (', 'changes.json did not load (') + e.message +
            say(') — הסימונים עובדים, אך בלי ״ביקשת״ ו״היה״',
                ') — the marks work, but without "You asked" and "Was"'), true);
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
      card(say('אין רשומה לשינוי הזה', 'No record for this change'),
           '<div class="was">' + say('changes.json לא נטען, או שאינו תואם את הסימונים.',
                                     'changes.json did not load, or does not match the marks.') + '</div>');
      return;
    }
    card(esc(c.slide),
      '<div class="k">' + say('ביקשת', 'You asked') + '</div><div class="ask">' + esc(c.ask) + '</div>' +
      '<div class="k">' + say('היה כתוב', 'Was') + '</div><div class="was">' + esc(c.was) + '</div>' +
      '<div class="k">' + say('עכשיו', 'Now') + '</div><div class="now">' +
      say('הטקסט המסומן בירוק בשקופית', 'the text marked green on the slide') + '</div>');
  }

  function goToMark(i) {
    if (!marks.length) return;
    at = (i + marks.length) % marks.length;
    var el = marks[at];
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    marks.forEach(function (m) { m.classList.remove('mark-flash'); });
    el.classList.add('mark-flash');
    nav.textContent = say('עודכן ', 'updated ') + (at + 1) + say(' מתוך ', ' of ') + marks.length;
    nav.title = say('המקום הבא ששיניתי', 'The next place I changed');
    showRecord(at);
  }

  var nav;
  if (marks.length) {
    nav = document.createElement('button');
    nav.id = 'btn-seen';
    nav.type = 'button';
    nav.textContent = say('עודכן: ', 'updated: ') + marks.length;
    nav.title = say('מעבר למקום הראשון ששיניתי', 'Go to the first place I changed');
    nav.onclick = function () { goToMark(at + 1); };

    /* forward-only meant that overshooting cost a lap of the whole deck */
    var prev = document.createElement('button');
    prev.id = 'btn-seen-prev';
    prev.type = 'button';
    prev.dataset.chrome = '1';
    prev.className = 'step';
    prev.textContent = '\u2039';
    prev.title = say('המקום הקודם ששיניתי', 'The previous place I changed');
    prev.onclick = function () { goToMark(at - 1); };

    var next = document.createElement('button');
    next.id = 'btn-seen-next';
    next.type = 'button';
    next.dataset.chrome = '1';
    next.className = 'step';
    next.textContent = '\u203a';
    next.title = say('המקום הבא ששיניתי', 'The next place I changed');
    next.onclick = function () { goToMark(at + 1); };

    var clr = document.createElement('button');
    clr.id = 'btn-seen-clr';
    clr.type = 'button';
    clr.textContent = say('נקרא', 'read');
    clr.title = say('מסיר את הסימון הירוק מכל מה שעודכן, ושומר',
                    'Takes the green mark off everything that was updated, and saves');
    clr.onclick = function () {
      if (!confirm(say('להסיר את סימוני העדכון מ-' + marked().length + ' מקומות ולשמור?',
                       'Take the update marks off ' + marked().length + ' places and save?'))) return;
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
      body = '<div class="k">' + say('ביקשתם', 'You asked') + '</div>' +
             '<div class="ask">' + say('רוקנתם את השורה — כלומר בקשה להוריד אותה',
                                       'You emptied the line — a request to take it out') + '</div>' +
             '<div class="k">' + say('היה כתוב', 'Was') + '</div><div class="was">' +
             esc(el.getAttribute('data-cut')) + '</div>' +
             '<div class="k">' + say('עכשיו', 'Now') + '</div><div class="now">' +
             say('השורה ריקה', 'the line is empty') + '</div>';
    } else {
      body = '<div class="k">' + say('ההערה שלכם', 'Your remark') + '</div><div class="ask">' +
             esc(txt(el)) + '</div>' +
             (changed(el)
               ? '<div class="k">' + say('היה כתוב', 'Was') + '</div><div class="was">' +
                 esc(el.dataset.orig) + '</div>'
               : '<div class="k">' + say('הנוסח לא שונה', 'The wording did not change') + '</div>' +
                 '<div class="was">' + say('ההערה נוספה לשורה, והנוסח עצמו נשאר.',
                                           'The remark was added to the line; the wording stayed.') + '</div>');
    }
    card('' + p.no + ' · ' + esc(p.name) +
         (gone ? say(' — למחיקה', ' — to delete') : say(' — הערה', ' — remark')), body);
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
      ? say('הערה ', 'remark ') + (noteAt + 1) + say(' מתוך ', ' of ') + n
      : say('דילוג להערות', 'go to remarks');
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
    notePrev.title = say('ההערה הקודמת שלכם', 'Your previous remark');
    notePrev.onclick = function () { goToNote(noteAt - 1); };

    noteNav = document.createElement('button');
    noteNav.id = 'btn-note';
    noteNav.type = 'button';
    noteNav.dataset.chrome = '1';
    noteNav.className = 'note';
    noteNav.title = say('מעבר להערה שכתבתם', 'Go to a remark you wrote');
    noteNav.onclick = function () { goToNote(noteAt + 1); };

    noteNext = document.createElement('button');
    noteNext.id = 'btn-note-next';
    noteNext.type = 'button';
    noteNext.dataset.chrome = '1';
    noteNext.className = 'step note';
    noteNext.textContent = '\u203a';
    noteNext.title = say('ההערה הבאה שלכם', 'Your next remark');
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
        if (nav) nav.textContent = say('עודכן ', 'updated ') + (at + 1) + say(' מתוך ', ' of ') + marks.length;
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
})();
