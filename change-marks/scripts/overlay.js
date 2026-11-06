// @ts-nocheck
// change-marks overlay — written by `change-marks on`, removed by `change-marks off`. Do not edit.
//
// The runtime half of a change mark: the badge a reader clicks, and the panel it opens. A stylesheet
// can draw a number with `::after` but nothing can click a pseudo-element, and a `title` tooltip
// loses to the element's own `title`. A real button and a real panel read the same way every time.
//
// The badges live in their own fixed layer, not inside the marked element: a mark can land on a
// `<select>`, an `<input>` or an `<img>`, which render no children, so a badge inside one would be
// in the DOM and invisible. Each badge is positioned from its element's rectangle.
//
// It only reads the DOM and writes into its own layer. It listens to nothing except clicks on its
// own badges, the Escape key, and scroll/resize.
(() => {
  const LABELS = __CHANGE_MARKS_LABELS__;
  const APP_ROOT_ID = __CHANGE_MARKS_APP_ROOT__;
  const LAYER_ID = 'change-marks-layer';
  const REASON_SEPARATOR = ' · ';

  let layer = null;
  /** badge → the marked element it belongs to, so a badge can be repositioned and read. */
  const hostOf = new WeakMap();

  function theLayer() {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement('div');
    layer.id = LAYER_ID;
    document.body.append(layer);
    return layer;
  }

  function closePanel() {
    const panel = theLayer().querySelector('.change-panel');
    if (panel) panel.remove();
    for (const open of theLayer().querySelectorAll('.change-badge[aria-expanded="true"]')) {
      open.setAttribute('aria-expanded', 'false');
    }
  }

  function openPanel(badge) {
    const host = hostOf.get(badge);
    if (!host) return;
    closePanel();

    const panel = document.createElement('div');
    panel.className = 'change-panel';

    const heading = document.createElement('strong');
    heading.className = 'change-panel__what';
    heading.textContent = LABELS.panelHeading + (badge.textContent || '');
    panel.append(heading);

    // Every reason on this element, in the order the changed lines appear.
    for (const reason of (host.dataset.changeNote || '').split(REASON_SEPARATOR)) {
      const line = document.createElement('span');
      line.className = 'change-panel__reason';
      line.textContent = reason;
      panel.append(line);
    }

    const where = document.createElement('span');
    where.className = 'change-panel__where';
    where.textContent = host.dataset.changeWhere || '';
    panel.append(where);

    const rect = badge.getBoundingClientRect();
    panel.style.top = `${rect.bottom + 4}px`;
    panel.style.insetInlineStart = `${Math.max(4, rect.left)}px`;
    theLayer().append(panel);
    badge.setAttribute('aria-expanded', 'true');
  }

  /** Put every badge back over its element. Called on draw, on scroll and on resize. */
  function place() {
    for (const badge of theLayer().querySelectorAll('.change-badge')) {
      const host = hostOf.get(badge);
      if (!host || !host.isConnected) {
        badge.remove();
        continue;
      }
      const rect = host.getBoundingClientRect();
      // An element scrolled out of view, or drawn with no box, gets no badge over the wrong place.
      const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
      badge.hidden = !visible;
      if (!visible) continue;
      badge.style.top = `${rect.top - 7}px`;
      badge.style.left = `${rect.left - 7}px`;
    }
  }

  /** One badge per marked element. Idempotent, so a re-render cannot stack badges. */
  function draw() {
    const drawn = new Set();
    for (const badge of theLayer().querySelectorAll('.change-badge')) {
      const host = hostOf.get(badge);
      if (host) drawn.add(host);
    }
    for (const host of document.querySelectorAll('[data-change]')) {
      if (drawn.has(host)) continue;
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'change-badge';
      badge.textContent = host.dataset.change || '?';
      // Hovering the number says what changed; clicking it opens the same words in a panel.
      badge.title = (host.dataset.changeNote || '').split(REASON_SEPARATOR).join('\n') || LABELS.badgeHint;
      badge.setAttribute('aria-expanded', 'false');
      badge.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (badge.getAttribute('aria-expanded') === 'true') closePanel();
        else openPanel(badge);
      });
      hostOf.set(badge, host);
      theLayer().append(badge);
    }
    place();
  }

  // The app re-renders as a person moves through it, so the badges are redrawn whenever the tree
  // changes. Cheap: `draw` skips any element that already has one. The observer watches the app
  // root when there is one, so the layer's own writes cannot feed back into it.
  const watch = () => {
    const root = document.getElementById(APP_ROOT_ID) || document.body;
    new MutationObserver(draw).observe(root, { childList: true, subtree: true });
    draw();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();

  window.addEventListener('scroll', place, { passive: true, capture: true });
  window.addEventListener('resize', place, { passive: true });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel();
  });
})();
