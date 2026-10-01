# Serving a deck, and the one viewer rule

## Serving

```
python <skill>/scripts/serve.py <deck-folder> [port]      # default port 8899
```

Serves every `.html` in the deck folder, prints their URLs, and serves the shared
chrome at `/_deck/`. One copy of the chrome for all decks — never copy the CSS/JS
into the deck folder.

**Do not open a browser to check your work.** Playwright runs its own profile and cannot
attach to the reader's window, so every check launches a second browser they did not ask
for, and it is slow. The reader has the deck open and will tell you what they see.

**`to_pptx.py` is the exception**, and it is not really one: its headless Chromium *is*
the work rather than a check of it -- it shoots every slide and closes. It never touches
the reader's window. Check what it produced with `--sheet`, not by opening a browser.

Verify from the shell instead, which catches most of what a screenshot would:

```bash
curl -s http://127.0.0.1:8899/<deck>.html | grep -c "<new text>"   # the change is on the wire
python <skill>/scripts/deck_text.py <deck>.html --slide NN         # it reads correctly
```

Tag balance needs no separate check -- `deck_edit.py` refuses to write an
unbalanced deck in the first place.

Render only when the reader asks, or when you have changed CSS in a way nobody will
look at before it ships — and say that you are doing it.

### Is one already running?

**Run `servers.py` the first time you touch a deck in a folder — before serving,
before editing, before quoting a URL.** Not only before starting a server: the point
is to find the viewer that already exists and use it. Every session working on the
same folder shares one viewer, because the reader has one window open and that window
is the only thing that matters.

A server started in an earlier session outlives that session, so "my background task
was killed" is not evidence that nothing is listening — the harness reaps a tracked
task, and a detached process survives it. Only the script knows.

The two ways this goes wrong, both silent: a second server on the same port dies with
`WinError 10048` while the stale one keeps answering, so the deck you think you
published is the previous round's; and a second server on a *different* port serves a
different folder, so the reader's edits are written to a deck you are not reading.
Never route around a busy port by choosing another one. A port held by a different
folder is a conflict to report, not to sidestep.

```
python <skill>/scripts/servers.py                  # every serve.py alive, and the folder each port really serves
python <skill>/scripts/servers.py --root DIR       # search elsewhere for deck folders
python <skill>/scripts/servers.py --kill-pid PID   # stop one process
python <skill>/scripts/servers.py --kill PORT      # stop whoever answers a port
```

Two columns matter, side by side: **folder asked for** — parsed from the process
command line — and **FOLDER ACTUALLY SERVED**, which is identified from the bytes. Every
deck folder under the root is hashed, the port's answer is hashed, and the match names
the folder. When those two columns disagree the process is an orphan: still alive, still
carrying a command line that says the right thing, and answering nothing.

**Neither the command line nor `Get-NetTCPConnection` can tell you which folder a port
serves.** A command line says what a process *asked* for; when two raced for a port, the
loser's is still there and still convincing. And the port→pid join returns *a different
owner between consecutive runs* when a port is contested — observed here, flipping twice
while the bytes never changed. Only the bytes settle it.

`AMBIGUOUS` means two folders hold identical bytes, so no port can be pinned to one of
them. That is the normal state of a freshly cloned round before it is stamped — the
report says so rather than picking a winner.

Nothing listening, and no other session is serving that folder → start one. It must
outlive the command **and the turn**: a tracked background task is reaped when the turn
ends, so launch it detached.

```
python <skill>/scripts/serve.py <deck-folder> 8899        # foreground form
```

```powershell
Start-Process python -ArgumentList '<skill>/scripts/serve.py','<deck-folder>','8899' `
  -WorkingDirectory <repo> -WindowStyle Hidden -PassThru   # survives the turn
```

Detached, it outlives the session too, so stop it deliberately with
`servers.py --kill <port>` rather than leaving it for the next reader to trip over.

An orphan — a process of **your own** that lost the port race — is safe to kill, and
`servers.py` names it. Never kill a server you did not start without saying so; someone
may be reading from it. To hand a port over to a different folder, stop the old process
first, then start yours.

Editing a deck's `.html`, `.css` or `.js` needs **no restart**; the server reads from
disk per request. Restart only after editing `serve.py` itself.

