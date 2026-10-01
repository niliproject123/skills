/* Every slide is drawn inside a fixed 1280x720 frame. Without this file the frame keeps
   that size whatever the window does: zoom in and the slide is cut off at the side and
   runs past the bottom of the screen. Here the whole deck is scaled by one factor, so a
   standard slide fills the window and every slide keeps the same width as its neighbours.
   A .slide.grow is taller than the frame by design; it keeps that width and scrolls,
   because shrinking it to fit the height would make it narrower than the deck around it. */
(function () {
  var DESIGN_WIDTH = 1280;
  var DESIGN_HEIGHT = 720;
  var GUTTER_SIDE = 22;        /* breathing room left and right of the frame */
  var GUTTER_ABOVE = 24;       /* below the deck bar, or below the top of the page */
  var GUTTER_BELOW = 16;       /* above the editing bar */
  var BIGGEST = 2;             /* on a very large screen, stop growing at twice the design */

  function heightOf(id) {
    var el = document.getElementById(id);
    return el ? el.offsetHeight : 0;
  }

  /* A deck may park something down one side -- a slide list, an outline. It cannot tell
     us by making the page narrower: clientWidth on the root element reports the viewport
     whatever margin or width the element itself carries, so the scale would still be
     computed for the full window and the slide would slide under the panel. The deck
     declares the width it has taken instead, and defaults to none. */
  function reservedAcross() {
    var v = getComputedStyle(document.documentElement)
              .getPropertyValue('--deck-reserve-x');
    return parseFloat(v) || 0;
  }

  function fitTheDeck() {
    var roomAcross = document.documentElement.clientWidth - 2 * GUTTER_SIDE
                   - reservedAcross();
    var roomDown = window.innerHeight
                 - (heightOf('deckbar') + GUTTER_ABOVE)
                 - (heightOf('bar') + GUTTER_BELOW);
    var scale = Math.min(roomAcross / DESIGN_WIDTH, roomDown / DESIGN_HEIGHT, BIGGEST);
    var slides = document.querySelectorAll('.slide');
    for (var i = 0; i < slides.length; i++) slides[i].style.zoom = String(scale);
  }

  /* the slide that is on screen should still be on screen after a refit */
  function refitKeepingPlace() {
    var slides = document.querySelectorAll('.slide'), here = null;
    var middle = window.innerHeight / 2;
    for (var i = 0; i < slides.length; i++) {
      var box = slides[i].getBoundingClientRect();
      if (box.top <= middle && box.bottom >= 0) { here = slides[i]; break; }
    }
    fitTheDeck();
    if (here) here.scrollIntoView({ block: 'center' });
  }

  var pending = null;
  window.addEventListener('resize', function () {         /* window resize and browser zoom */
    clearTimeout(pending);
    pending = setTimeout(refitKeepingPlace, 120);
  });
  fitTheDeck();
})();
