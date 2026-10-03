/* The slide list down the side: it marks where you are, and it gets out of the way.

   The markup is written into the deck by deck_nav.py, not by this file -- a reader who
   saves the deck keeps the list, and a reader with javascript off still has the links.
   Three things only happen here, all of them about the live window:

   1. the width the list took is published as --deck-reserve-x, because fit.js cannot
      measure it: clientWidth reports the whole viewport whatever a fixed panel covers,
      so without this the slides are scaled for the full window and slide under the list.
   2. the slide in view is marked .here and scrolled into view inside the list.
   3. a narrow window folds the list away, because 1280px of slide comes first.

   Nothing here writes to the deck, and the element carries no editing attributes, so
   edit.js never arms it and cleanHTML has nothing to strip. */
(function () {
  var bar = document.getElementById('slidebar');
  if (!bar) return;
  var NARROW = 1180;          /* below this the slide needs every pixel */
  var links = [].slice.call(bar.querySelectorAll('a[href^="#"]'));
  var slides = links.map(function (a) { return document.getElementById(a.hash.slice(1)); });

  var published = null;
  function publishWidth() {
    var folded = window.innerWidth < NARROW;
    document.body.classList.toggle('slidebar-folded', folded);
    var w = folded ? 0 : bar.getBoundingClientRect().width;
    if (w === published) return;        /* the synthetic resize below comes back to our own
                                           handler, so re-announcing an unchanged width is
                                           a loop that never settles */
    published = w;
    document.documentElement.style.setProperty('--deck-reserve-x', w + 'px');
    /* fit.js listens for resize and rescales; the slides must be measured against the
       room that is actually left, so tell it after the width changed and not before */
    window.dispatchEvent(new Event('resize'));
  }

  var here = null;
  function mark() {
    var middle = window.innerHeight / 2, pick = null;
    /* the last slide whose top is above the middle of the window. Not the first one still
       visible: after a jump the previous slide's last strip sits on screen behind the deck
       bar, and taking it marked 04 when the reader had clicked 05 */
    for (var i = 0; i < slides.length; i++) {
      if (!slides[i]) continue;
      if (slides[i].getBoundingClientRect().top <= middle) pick = links[i];
    }
    if (!pick || pick === here) return;
    if (here) here.classList.remove('here');
    pick.classList.add('here');
    here = pick;
    var seen = pick.getBoundingClientRect(), list = bar.getBoundingClientRect();
    if (seen.top < list.top + 8 || seen.bottom > list.bottom - 8) {
      pick.scrollIntoView({ block: 'nearest' });
    }
  }

  var pending = null;
  function later(fn) {
    return function () { clearTimeout(pending); pending = setTimeout(fn, 80); };
  }
  window.addEventListener('scroll', mark, { passive: true });
  window.addEventListener('resize', later(function () { publishWidth(); mark(); }));
  publishWidth();
  mark();
})();
