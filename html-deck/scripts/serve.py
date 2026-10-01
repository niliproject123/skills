# -*- coding: utf-8 -*-
"""Deck server: serves a folder of HTML decks, and saves an edited deck over itself.

    python serve.py <deck-folder> [port]

Shared chrome (deck.css / edit.css / edit.js) is served from this script's own
folder under /_deck/, so every deck links the same one copy.

The reader edits the slides in the browser and presses save; the page posts the
whole document back and it is written to the deck's own file. There is no side
store and no before/after bookkeeping: the file IS the current state, so reading
the deck is reading the feedback. Reader remarks are written inline, prefixed
"michael:", and are found by grepping the file.

Every save first copies the previous file into <deck-folder>/.bak/, keeping the
last BACKUPS versions, so a bad save is never the only copy.
"""
import io, json, os, re, shutil, sys, time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

# A Windows console is cp1252, and a deck title is not: without this the script dies while
# printing the title it just read off the wire. Decks are Hebrew, Arabic, Greek more often than not.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


ASSETS = os.path.dirname(os.path.abspath(__file__))
DECKS = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.getcwd()
BAK_DIR = os.path.join(DECKS, ".bak")
SAFE = re.compile(r"^[A-Za-z0-9._-]+$")
ASSET_TYPES = {".css": "text/css", ".js": "application/javascript"}
BACKUPS = 20
# A read-only archive of decks that were cut from the live set -- served so the reader
# can open what was removed, never written to. Found next to the deck folder, or up to
# three levels above it, so the archive can sit beside the spec rather than beside the
# decks. Nothing is served from it unless the folder actually exists.
ARCHIVE_NAME = "stage2"


def find_archive(start, name=ARCHIVE_NAME, levels=3):
    d = os.path.abspath(start)
    for _ in range(levels + 1):
        p = os.path.join(d, name)
        if os.path.isdir(p):
            return p
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    return None


MAX_BODY = 8 * 1024 * 1024
# The deck invites the remark in either language and edit.js highlights both,
# so the count has to accept both. Counting only the English form reported a
# Hebrew remark as "0 notes in the file" -- which reads as "your remark was lost".
NOTE_MARK = re.compile(r"(michael|מיכאל)\s*:", re.I)


def rel(p):
    return os.path.relpath(p, DECKS).replace(os.sep, "/")


# --- remarks on a page that is not a deck -----------------------------------------
# A deck carries its feedback inside itself, because saving writes over the file. A
# generated page cannot: the next build would overwrite the remark. So its remarks live
# in a json file beside it, keyed by the anchor the reader clicked, and the build reads
# them back in. Only a page in this folder can have one, and the name is derived from
# the page rather than sent by the caller.
MAX_NOTE = 256 * 1024


def notes_path(doc):
    name = (doc or "fake-data.html").rsplit("/", 1)[-1]
    if not name.endswith(".html") or not SAFE.match(name):
        raise ValueError("bad page name: %r" % doc)
    return os.path.join(DECKS, name[:-len(".html")] + ".comments.json")


def read_notes(path):
    if not os.path.exists(path):
        return {}
    return json.loads(io.open(path, encoding="utf-8").read()).get("comments", {})


def write_notes(path, comments):
    """Backed up the same way a deck is: a remark is the reader's words, and losing one
    is worse than losing a generated page, which can always be rebuilt."""
    if os.path.exists(path):
        bak = os.path.join(os.path.dirname(path), ".bak")
        if not os.path.isdir(bak):
            os.makedirs(bak)
        base = os.path.basename(path)
        shutil.copy2(path, os.path.join(
            bak, "%s.%s.json" % (base[:-len(".json")], time.strftime("%Y%m%d-%H%M%S"))))
        old = sorted(f for f in os.listdir(bak) if f.startswith(base[:-len(".json")]))
        for f in old[:-BACKUPS]:
            os.remove(os.path.join(bak, f))
    with io.open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps({"comments": comments}, ensure_ascii=False, indent=1))


def deck_path(doc):
    """Resolve a deck name to its file. The name may carry the archive folder in front
    of it -- "stage2/stage2.flow.html" -- and nothing else. Every other separator is
    refused, so a save can never land outside the two folders this server shows."""
    parts = [x for x in (doc or "").replace("\\", "/").split("/") if x]
    folder = DECKS
    if len(parts) == 2 and parts[0] == ARCHIVE_NAME:
        if ARCHIVE is None:
            raise ValueError("no %s folder found near %s" % (ARCHIVE_NAME, DECKS))
        folder, parts = ARCHIVE, parts[1:]
    if len(parts) != 1:
        raise ValueError("bad deck name: %r" % doc)
    name = parts[0]
    if not name.endswith(".html") or not SAFE.match(name):
        raise ValueError("bad deck name: %r" % doc)
    p = os.path.join(folder, name)
    if not os.path.exists(p):
        raise ValueError("no such deck: %s" % name)
    return p


def back_up(path):
    """Keep the previous version before overwriting, newest last."""
    bak = os.path.join(os.path.dirname(path), ".bak")
    os.makedirs(bak, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    base = os.path.basename(path)[:-5]
    shutil.copy2(path, os.path.join(bak, "%s.%s.html" % (base, stamp)))
    old = sorted(f for f in os.listdir(bak)
                 if f.startswith(base + ".") and f.endswith(".html"))
    for f in old[:-BACKUPS]:
        os.remove(os.path.join(bak, f))
    return len(old[-BACKUPS:])


ARCHIVE = find_archive(DECKS)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DECKS, **kw)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    def _json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _asset(self, name):
        """Shared chrome comes out of the skill folder, never out of the deck folder."""
        if not SAFE.match(name) or os.path.splitext(name)[1] not in ASSET_TYPES:
            return self._json(400, {"error": "bad asset name: %r" % name})
        p = os.path.join(ASSETS, name)
        if not os.path.exists(p):
            return self._json(404, {"error": "missing asset %s in %s" % (name, ASSETS)})
        body = io.open(p, "rb").read()
        self.send_response(200)
        self.send_header("Content-Type",
                         ASSET_TYPES[os.path.splitext(name)[1]] + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    ARCHIVE_TYPES = {".html": "text/html; charset=utf-8",
                     ".json": "application/json; charset=utf-8"}

    def _archive(self, name):
        """The decks that were cut from the live set. They are edited and saved exactly
        like the live ones -- what was removed still has to be judged and corrected."""
        if ARCHIVE is None:
            return self._json(404, {"error": "no %s folder found near %s"
                                    % (ARCHIVE_NAME, DECKS)})
        kind = self.ARCHIVE_TYPES.get(os.path.splitext(name)[1])
        if not SAFE.match(name) or kind is None:
            return self._json(400, {"error": "bad archive name: %r" % name})
        p = os.path.join(ARCHIVE, name)
        if not os.path.exists(p):
            return self._json(404, {"error": "no such archived deck: %s" % name})
        body = io.open(p, "rb").read()
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path.rstrip("/").endswith("/api/comments"):
            doc = (parse_qs(u.query).get("doc") or [""])[0]
            try:
                return self._json(200, {"comments": read_notes(notes_path(doc))})
            except Exception as e:
                return self._json(400, {"error": "%s: %s" % (type(e).__name__, e)})
        if u.path.startswith("/_deck/"):
            return self._asset(u.path[len("/_deck/"):])
        if u.path.startswith("/%s/" % ARCHIVE_NAME):
            return self._archive(u.path[len(ARCHIVE_NAME) + 2:])
        return super().do_GET()

    def end_headers(self):
        """A deck is rewritten in place, so a cached copy would hide the reader's
        own saved edits on the next load."""
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        u = urlparse(self.path)
        if u.path.rstrip("/").endswith("/api/comment"):
            return self._comment(u)
        if u.path != "/api/deck":
            return self._json(404, {"error": "unknown endpoint " + u.path})
        doc = (parse_qs(u.query).get("doc") or [""])[0]
        try:
            path = deck_path(doc)
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > MAX_BODY:
                raise ValueError("refusing a %d byte document" % n)
            html = self.rfile.read(n).decode("utf-8")
            if "<section" not in html or "</html>" not in html:
                raise ValueError("document does not look like a deck; not saving")
            kept = back_up(path)
            with io.open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(html)
        except Exception as e:
            return self._json(500, {"error": "%s: %s" % (type(e).__name__, e)})
        return self._json(200, {"file": rel(path), "bytes": len(html), "backups": kept,
                                "notes": len(NOTE_MARK.findall(html))})

    def _comment(self, u):
        """One remark, appended to the page's store. Append only, like everything else
        the reader writes: an existing remark is never rewritten by a new one."""
        try:
            path = notes_path((parse_qs(u.query).get("doc") or [""])[0])
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > MAX_NOTE:
                raise ValueError("refusing a %d byte remark" % n)
            item = json.loads(self.rfile.read(n).decode("utf-8"))
            anchor = (item.get("anchor") or "").strip()
            text = (item.get("text") or "").strip()
            if not anchor or not text:
                raise ValueError("anchor and text are both required")
            comments = read_notes(path)
            comments.setdefault(anchor, []).append({
                "author": (item.get("author") or "michael").strip(),
                "label": item.get("label") or "",
                "text": text,
                "at": time.strftime("%Y-%m-%d %H:%M")})
            write_notes(path, comments)
        except Exception as e:
            return self._json(400, {"error": "%s: %s" % (type(e).__name__, e)})
        return self._json(200, {"comments": comments})


if __name__ == "__main__":
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8899
    if not os.path.isdir(DECKS):
        sys.exit("deck folder does not exist: %s" % DECKS)
    decks = sorted(f for f in os.listdir(DECKS) if f.endswith(".html"))
    print("decks   : %s" % DECKS)
    print("assets  : %s  (served at /_deck/)" % ASSETS)
    print("backups : %s  (last %d per deck)" % (BAK_DIR, BACKUPS))
    if ARCHIVE:
        arch = sorted(f for f in os.listdir(ARCHIVE) if f.endswith(".html"))
        print("archive : %s  (editable, %d deck(s))" % (ARCHIVE, len(arch)))
        for a in arch:
            print("   http://127.0.0.1:%d/%s/%s" % (port, ARCHIVE_NAME, a))
    else:
        print("archive : none found (looked for a %r folder above %s)"
              % (ARCHIVE_NAME, DECKS))
    for d in decks:
        print("   http://127.0.0.1:%d/%s" % (port, d))
    if not decks:
        print("   (no .html files found in the deck folder)")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
