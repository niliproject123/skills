# -*- coding: utf-8 -*-
"""Which deck servers exist, and which folder each port is really serving.

    python servers.py [--root DIR]     # the inventory
    python servers.py --kill PORT...   # stop whoever answers that port
    python servers.py --kill-pid PID...

A server started in an earlier session outlives that session, so a project ends up with
several alive at once. That is dangerous rather than untidy: `serve.py` on a taken port
dies with WinError 10048 while the stale server keeps answering, so the deck you think
you published is the previous round's -- and the reader's saves land in the folder the
*old* server was pointed at.

**The folder is identified from the bytes, not from the command line.** Every deck
folder under the search root is hashed, the port's answer is hashed, and the match names
the folder. A process's command line only says what it *asked* for; when two processes
raced for a port, the loser's command line is still there, still wrong, and still
convincing. Do not diagnose a port with `Get-NetTCPConnection` either -- with a contested
port that join returns a different owner between consecutive runs (observed, flipping
twice, while the bytes never changed).

Two folders can hold identical files -- a freshly cloned round is byte-identical to the
one it came from until it is stamped. That is reported as ambiguous rather than guessed.
"""
import os, re, sys, json, hashlib, subprocess
import urllib.request

# A Windows console is cp1252, and a deck title is not: without this the script dies while
# printing the title it just read off the wire. Decks are Hebrew, Arabic, Greek more often than not.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


LO, HI = 8890, 8920
TITLE = re.compile(r'<title>([^<]*)</title>')
SERVE = re.compile(r'serve\.py"?\s+"?([^"]+?)"?\s+(\d+)\s*$')
SKIP = {'.git', 'node_modules', '.bak', '__pycache__', '.venv'}
# The deck names are whatever is on disk, never a list written here. A hard-coded pair of
# names reported every other project's live viewer as "nothing answering" -- which is the
# one verdict that gets a reader's window killed, and it was wrong.
ROOT = os.environ.get('DECK_ROOT') or os.getcwd()


def ps(script):
    out = subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', script],
                         capture_output=True, text=True).stdout.strip()
    if not out:
        return []
    rows = json.loads(out)
    return [rows] if isinstance(rows, dict) else rows


def processes():
    """Every serve.py alive: pid, the folder and port it was *given*, when it started."""
    rows = ps("Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
              "Where-Object { $_.CommandLine -like '*serve.py*' } | "
              "ForEach-Object { [pscustomobject]@{ ProcessId = $_.ProcessId; "
              "CommandLine = $_.CommandLine; "
              "Born = $_.CreationDate.ToString('MM-dd HH:mm') } } | ConvertTo-Json -Compress")
    out = []
    for r in rows:
        cmd = (r.get('CommandLine') or '').strip()
        m = SERVE.search(cmd)
        out.append({'pid': r['ProcessId'],
                    'asked': os.path.normpath(m.group(1)) if m else None,
                    'port': int(m.group(2)) if m else None,
                    'born': r.get('Born') or '?',
                    'cmd': cmd})
    return sorted(out, key=lambda x: (x['port'] or 0, x['pid']))


def listeners():
    """port -> pid the OS says holds it. Unreliable when contested; shown, never trusted."""
    rows = ps("Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | "
              "Where-Object { $_.LocalPort -ge %d -and $_.LocalPort -le %d } | "
              "Select-Object LocalPort, OwningProcess | ConvertTo-Json -Compress" % (LO, HI))
    return {int(r['LocalPort']): r['OwningProcess'] for r in rows}


def digest(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12]


def hash_folder(base):
    decks = {}
    try:
        names = sorted(n for n in os.listdir(base) if n.lower().endswith('.html'))
    except Exception:
        return decks
    for name in names:
        path = os.path.join(base, name)
        if os.path.isfile(path):
            try:
                # newline='' keeps CRLF intact. Without it python translates the line
                # endings away, the disk hash never equals the hash of the same file on
                # the wire, and every live viewer in a CRLF checkout is reported as an
                # orphan to be killed. 580 of those endings in the deck that found this.
                decks[name] = digest(open(path, encoding='utf-8', newline='').read())
            except Exception:
                pass
    return decks


def deck_folders(root, extra=()):
    """Every folder under root holding a deck file -> {deck name: hash}.

    `extra` folders are hashed too even when they sit outside the root -- a process's
    own folder must always be a candidate, or narrowing --root turns a healthy server
    into a false orphan by matching it to some copy that happens to be inside.
    """
    found = {}
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP]
        decks = hash_folder(base)
        if decks:
            found[os.path.abspath(base)] = decks
    for base in extra:
        if not base:
            continue
        for cand in (base, os.path.join(ROOT, base)):
            cand = os.path.abspath(cand)
            if cand not in found and os.path.isdir(cand):
                decks = hash_folder(cand)
                if decks:
                    found[cand] = decks
                break
    return found


def alive(port):
    """Is anything answering there at all, whatever it is serving?"""
    try:
        urllib.request.urlopen('http://127.0.0.1:%d/' % port, timeout=3).read()
        return True
    except Exception:
        return False


def answering(port, names):
    """Fetch each known deck name from the port. -> {deck name: (hash, title, bytes)}

    `names` is every .html seen in any candidate folder, so the probe covers whatever this
    machine's decks are called instead of a list written into this file.
    """
    got = {}
    for name in names:
        try:
            body = urllib.request.urlopen('http://127.0.0.1:%d/%s' % (port, name),
                                          timeout=3).read().decode('utf-8', 'replace')
        except Exception:
            continue
        m = TITLE.search(body)
        got[name] = (digest(body), m.group(1) if m else '(no title)', len(body))
    return got


def identify(served, folders):
    """Which folder on disk holds exactly what this port returned.

    A folder matches only if every deck the port served is byte-identical there.
    Returns the list of matches -- more than one means two folders hold the same
    bytes, which is the truth and not something to break a tie on.
    """
    if not served:
        return []
    hits = []
    for folder, decks in folders.items():
        if all(decks.get(n) == h for n, (h, _, _) in served.items()):
            hits.append(folder)
    return sorted(hits)


def resolve(folder):
    """A process's folder as an absolute path -- it may be relative to the repo root,
    because that is the cwd serve.py is normally launched from."""
    if not folder:
        return None
    for cand in (folder, os.path.join(ROOT, folder)):
        cand = os.path.abspath(cand)
        if os.path.isdir(cand):
            return cand
    return os.path.abspath(folder)


def short(path, root):
    if not path:
        return '(unparsed command line)'
    try:
        rel = os.path.relpath(path, root)
        if not rel.startswith('..'):
            path = rel
    except ValueError:
        pass
    return path.replace('\\', '/')


def kill(pid, why):
    r = subprocess.run(['taskkill', '/PID', str(pid), '/F'], capture_output=True, text=True)
    ok = r.returncode == 0
    print('pid %s: %s -- %s' % (pid, 'killed' if ok else 'NOT killed', why))
    if not ok:
        sys.stderr.write((r.stderr or r.stdout).strip() + '\n')
    return ok


def main():
    argv = sys.argv[1:]
    root = argv[argv.index('--root') + 1] if '--root' in argv else ROOT
    root = os.path.abspath(root)

    if '--kill-pid' in argv:
        for p in argv[argv.index('--kill-pid') + 1:]:
            kill(int(p), 'asked by pid')
        return 0
    if '--kill' in argv:
        live = listeners()
        for p in argv[argv.index('--kill') + 1:]:
            port = int(p)
            if port not in live:
                print('%d: nothing listening' % port)
                continue
            kill(live[port], 'answered port %d' % port)
        return 0

    procs = processes()
    if not procs:
        print('no serve.py process alive')
        return 0

    folders = deck_folders(root, extra=[p['asked'] for p in procs])
    live = listeners()
    ports = sorted({p['port'] for p in procs if p['port']})
    names = sorted({n for decks in folders.values() for n in decks})
    served = {port: answering(port, names) for port in ports}
    up = {port: alive(port) for port in ports}

    print('%-6s %-7s %-38s %-38s %s'
          % ('port', 'pid', 'folder asked for', 'FOLDER ACTUALLY SERVED', 'title on the wire'))
    print('-' * 140)
    orphans, ambiguous = [], []
    for p in procs:
        port, got = p['port'], served.get(p['port'], {})
        hits = identify(got, folders)
        asked = short(p['asked'], root)
        title = next((t for _, t, _ in got.values()), '')
        # compare resolved paths, never the display strings -- short() rewrites a path
        # relative to --root, so two spellings of one folder compare unequal
        want = resolve(p['asked'])
        matched = want is not None and want in hits
        if not got and up.get(port):
            # it answers, and holds no deck this run knows the name of. That is a folder
            # outside --root, not a dead process: never call it an orphan, because the
            # next thing a session does with that word is kill it
            real, note = '(answering - its folder is outside --root)', ''
        elif not got:
            real, note = '(nothing answering)', ''
            orphans.append(p)
        elif not hits:
            real, note = '(no folder on disk matches)', title
            orphans.append(p)
        elif len(hits) > 1:
            real = ' | '.join(short(h, root) for h in hits)
            note = title
            ambiguous.append((port, hits))
        else:
            real, note = short(hits[0], root), title
        if got and hits and not matched:
            orphans.append(p)
            real = '%s  <-- NOT what this pid asked for' % real
        print('%-6s %-7s %-38s %-38s %s' % (port, p['pid'], asked, real, note))

    print()
    by_folder = {}
    for port, got in served.items():
        for f in identify(got, folders):
            by_folder.setdefault(short(f, root), []).append(port)
    print('%d process(es); %d port(s) answering, over %d folder(s):'
          % (len(procs), len([p for p in ports if served.get(p)]), len(by_folder)))
    for f, ps_ in sorted(by_folder.items()):
        print('  %-46s port %s' % (f, ', '.join(str(x) for x in sorted(set(ps_)))))

    claims = {}
    for p in procs:
        claims.setdefault(p['port'], []).append(p['pid'])
    contested = {k: v for k, v in claims.items() if len(v) > 1}
    if contested:
        print('\nCONTESTED -- two processes were started on the same port.')
        for port, pids in sorted(contested.items()):
            print('  port %d claimed by pids %s; the OS names %s, but that join returns a'
                  % (port, ', '.join(str(x) for x in pids), live.get(port, 'nobody')))
            print('  different pid between runs. The served folder above is the answer.')
    if ambiguous:
        print('\nAMBIGUOUS -- these folders hold identical bytes, so the port cannot be')
        print('pinned to one of them. Usually a freshly cloned round, not yet stamped:')
        for port, hits in ambiguous:
            print('  port %d: %s' % (port, ' | '.join(short(h, root) for h in hits)))
    if orphans:
        print('\nORPHANS -- serving nothing, or not the folder they asked for:')
        for p in orphans:
            print('  pid %-7s asked port %-6s %s   (started %s)'
                  % (p['pid'], p['port'], short(p['asked'], root), p['born']))
        print('  kill only your own:  python servers.py --kill-pid %s'
              % ' '.join(str(p['pid']) for p in orphans))
    if not contested and not orphans and not ambiguous:
        print('\nall clean: every port serves the folder its process asked for')
    return 0


if __name__ == '__main__':
    sys.exit(main())
