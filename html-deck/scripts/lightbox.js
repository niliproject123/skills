/* Full-screen view of a slide image.
   Click any picture on a slide and it opens over the whole window, with its drawings.
   Esc, the x button, or a click on the dark area around it closes it.

   What is shown is a COPY of the picture (and of its drawings): the original stays where
   it is in the slide, so a save while the view is open writes the slide as it is, and the
   view itself is chrome (data-chrome) that cleanHTML strips. draw.js draws on the copy
   and writes the result back to the original -- see deckLightbox.source().

   Loaded by edit.js. Exposes window.deckLightbox for draw.js. */
(function () {
  var E = window.deckEdit, say = E.say;
  var view, stage, tools, current = null, frame = null;
  var openers = [], closers = [];
  var ROOM_ACROSS = 0.92;           /* share of the window the picture may take across */
  var ROOM_DOWN = 150;              /* px kept free for the tool row and the margins */

  function build() {
    view = document.createElement('div');
    view.id = 'lightbox';
    view.dataset.chrome = '1';
    view.innerHTML = '<div class="lb-tools"></div><div class="lb-stage"></div>' +
      '<button type="button" class="lb-x" title="' + say('סגירה', 'Close') + ' (Esc)">×</button>';
    document.body.appendChild(view);
    stage = view.querySelector('.lb-stage');
    tools = view.querySelector('.lb-tools');
    view.querySelector('.lb-x').onclick = close;
    view.addEventListener('click', function (e) {
      if (e.target === view || e.target === stage) close();
    });
  }

  /* the picture's frame on the slide: the wrapper that holds its drawings, or the bare
     <img> when nothing was drawn on it yet */
  function frameOf(img) { return img.closest('.drawn-on') || img; }

  /* The copy is sized here, not by CSS: a picture drawn as svg often has no size of its
     own, only a shape, and `width:auto` then fills the window and loses that shape. The
     shape on the slide is the one the drawings were made against, so it is the one kept. */
  function size() {
    if (!current) return;
    var r = current.getBoundingClientRect();
    if (!r.width || !r.height) {
      E.flash(say('לא ניתן להציג את התמונה במסך מלא: אין לה גודל בשקופית',
                  'The picture cannot open full screen: it has no size on the slide'), true);
      close();
      return;
    }
    var ratio = r.width / r.height;
    var w = Math.min(window.innerWidth * ROOM_ACROSS, (window.innerHeight - ROOM_DOWN) * ratio);
    var img = frame.querySelector('img') || frame;
    img.style.width = Math.round(w) + 'px';
    img.style.height = Math.round(w / ratio) + 'px';
  }

  function render() {
    stage.innerHTML = '';
    var copy = frameOf(current).cloneNode(true);
    if (copy.tagName === 'IMG') {
      var wrap = document.createElement('span');
      wrap.className = 'drawn-on';
      wrap.appendChild(copy);
      copy = wrap;
    }
    copy.classList.add('lb-frame');
    stage.appendChild(copy);
    frame = copy;
    size();
  }

  function open(img) {
    if (!view) build();
    current = img;
    render();
    view.classList.add('on');
    document.documentElement.classList.add('lightbox-open');
    openers.forEach(function (fn) { fn(); });
  }

  function close() {
    if (!current) return;
    closers.forEach(function (fn) { fn(); });
    view.classList.remove('on');
    document.documentElement.classList.remove('lightbox-open');
    stage.innerHTML = '';
    current = frame = null;
  }

  document.addEventListener('click', function (e) {
    var img = e.target.closest && e.target.closest('.slide img');
    if (!img || e.target.closest('[data-chrome]')) return;
    e.preventDefault();
    open(img);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current && !e.defaultPrevented) close();
  });
  window.addEventListener('resize', size);

  window.deckLightbox = {
    open: open,
    close: close,
    isOpen: function () { return !!current; },
    source: function () { return current; },      /* the original <img> on the slide */
    frame: function () { return frame; },         /* the copy shown full screen */
    tools: function () { return tools; },
    refresh: render,                              /* copy the slide's drawings again */
    onOpen: function (fn) { openers.push(fn); },
    onClose: function (fn) { closers.push(fn); }
  };
})();
