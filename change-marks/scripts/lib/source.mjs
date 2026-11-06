// Reading one UI source file: where its plain HTML elements open and close, which lines are
// comments, and how to write an attribute value. No git, no file system — text in, spans out.
//
// Two kinds of file are read: JSX (.tsx/.jsx — `//`, `/* */` and `{/* */}` comments, components
// start with a capital) and HTML (.html/.htm — `<!-- -->` comments, no components).

export const kindOf = (path) => (/\.html?$/i.test(path) ? 'html' : 'jsx');

/** A change inside one of these has nothing to outline — the element draws no box. */
const DRAWS_NOTHING = new Set(['br', 'wbr']);

/** A changed line that is only a comment changes no pixel and is never marked. */
export const isCommentLine = (text, kind) =>
  kind === 'html' ? /^<!--/.test(text) : /^(\/\/|\/\*|\{\/\*|\*)/.test(text);

/** Which lines start inside a block comment, so a commented-out tag is never marked. */
export function commentedLines(source, kind = 'jsx') {
  const [opener, closer] = kind === 'html' ? ['<!--', '-->'] : ['/' + '*', '*' + '/'];
  const inside = [];
  let open = false;
  for (const line of source.split('\n')) {
    inside.push(open);
    let i = 0;
    while (i < line.length) {
      if (!open && line.startsWith(opener, i)) {
        open = true;
        i += opener.length;
        continue;
      }
      if (open && line.startsWith(closer, i)) {
        open = false;
        i += closer.length;
        continue;
      }
      if (kind === 'jsx' && !open && line.startsWith('//', i)) break;
      i += 1;
    }
  }
  return inside;
}

/**
 * Every plain HTML element that opens a line, with the span of source it covers.
 *
 * Custom components are left out on purpose: a `<Screen>` or an `<Action>` decides for itself which
 * props reach the DOM, so an attribute put on one may never appear in the browser, and a mark you
 * cannot see is worse than no mark. A change inside a component is therefore drawn on the nearest
 * real element around it, which is the box a person can actually see.
 */
export function elementExtents(source, commented, first = /^([ \t]*)<([a-z][a-z0-9]*)\b/) {
  const lines = source.split('\n');
  const offsets = [0];
  for (const line of lines) offsets.push(offsets[offsets.length - 1] + line.length + 1);

  const extents = [];
  for (let at = 1; at <= lines.length; at += 1) {
    if (commented[at - 1]) continue;
    const opening = first.exec(lines[at - 1]);
    if (!opening) continue;
    const tag = opening[2];
    if (DRAWS_NOTHING.has(tag)) continue;
    const start = offsets[at - 1] + opening[1].length;
    const tagEnd = openingTagEnd(source, start);
    if (tagEnd === -1) continue;
    const end = source[tagEnd - 1] === '/' ? tagEnd : closingTagEnd(source, tagEnd, tag);
    if (end === -1) continue;
    extents.push({ line: at, tag, column: opening[1].length, start, end });
  }
  return { extents, offsets };
}

/** The same, for custom components (`<Action …>`) — only to name them when a change is a prop. */
export const componentExtents = (source, commented) =>
  elementExtents(source, commented, /^([ \t]*)<([A-Z][A-Za-z0-9]*)\b/);

/** Where `</tag>` balances the opening one, so an element's span is the tree and not the indent. */
export function closingTagEnd(source, from, tag) {
  const finder = new RegExp(`<(/?)${tag}\\b`, 'g');
  finder.lastIndex = from;
  let depth = 1;
  let match;
  while ((match = finder.exec(source))) {
    if (match[1] === '/') {
      depth -= 1;
      if (!depth) return source.indexOf('>', match.index);
    } else {
      const end = openingTagEnd(source, match.index);
      if (end !== -1 && source[end - 1] !== '/') depth += 1;
    }
  }
  return -1;
}

/** The tightest element around a change — the smallest box that still contains it. */
export function innermost(extents, offset) {
  let best = null;
  for (const extent of extents) {
    if (offset < extent.start || offset > extent.end) continue;
    if (!best || extent.end - extent.start < best.end - best.start) best = extent;
  }
  return best;
}

/** Where the opening tag ends, counting braces and quotes so a `{…}` prop cannot fool it. */
export function openingTagEnd(source, start) {
  let depth = 0;
  let quote = null;
  for (let i = start + 1; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0) return i;
  }
  return -1;
}

/** The line an offset falls on, 0-based, from the line-start offsets `elementExtents` returns. */
export function lineIndexOf(offsets, at) {
  let low = 0;
  let high = offsets.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (offsets[middle] <= at) low = middle;
    else high = middle - 1;
  }
  return low;
}

/**
 * Every plain HTML element, wherever on its line it opens — `--notes` only. The diff mode reads
 * elements that open a line, which is enough to find the box around a changed line; an item a
 * person listed can be a `<p>` after a `{cond ? … :` or a `<span>` inside a cell, and those open
 * mid-line. A tag counts only after a space, `>`, `(`, `{`, `?`, `:`, `&` or `|` — what JSX puts
 * before one — so `useState<string>` or a `'<p>'` inside a string is never taken for an element.
 */
export function elementExtentsAnywhere(source, commented, kind = 'jsx') {
  const { offsets } = elementExtents(source, commented);
  const lines = source.split('\n');
  const extents = [];
  const opener = /(^|[\s>({?:&|])<([a-z][a-z0-9]*)\b/gm;
  let match;
  while ((match = opener.exec(source))) {
    const start = match.index + match[1].length;
    const index = lineIndexOf(offsets, start);
    const column = start - offsets[index];
    if (commented[index]) continue;
    if (kind === 'jsx' && lines[index].slice(0, column).includes('//')) continue;
    const tag = match[2];
    if (DRAWS_NOTHING.has(tag)) continue;
    const tagEnd = openingTagEnd(source, start);
    if (tagEnd === -1) continue;
    const end = source[tagEnd - 1] === '/' ? tagEnd : closingTagEnd(source, tagEnd, tag);
    if (end === -1) continue;
    extents.push({ line: index + 1, tag, column, start, end });
  }
  return { extents, offsets };
}

export const escapeAttribute = (text) =>
  text.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');

export const unescapeAttribute = (text) =>
  text.split('&quot;').join('"').split('&lt;').join('<').split('&gt;').join('>').split('&amp;').join('&');

export const shorten = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
