# env up — deck drawings (2026-11-10)

- repo: C:\dev\skills, branch `main`, pushed to origin 2026-11-11
- ~/.claude/skills/html-deck is a junction to C:\dev\skills\html-deck — the changes are live for every deck server on this machine
- example deck: discussions/11.26-deck-drawings/example-deck
- server: `python html-deck/scripts/serve.py discussions/11.26-deck-drawings/example-deck 8911`
- url: http://127.0.0.1:8911/deck.html — no credentials
- start it as its own process (PowerShell `Start-Process python ... -WindowStyle Hidden`): as a background task of a
  Claude session it stopped twice (exit 127, exit 4) on 2026-11-10/11
- gouda deck servers 8901, 8905, 8907, 8909: all found stopped on 2026-11-10, not restarted by this session

## tests (nothing mocked)
    cd html-deck
    python tests/drawings_test.py ../discussions/11.26-deck-drawings/example-deck --compare-with ae02c82 --shots ../discussions/11.26-deck-drawings/screenshots --report ../discussions/11.26-deck-drawings/reports/01_drawings-browser-test/01_drawings-browser-test.md
    python tests/drawings_export_test.py ../discussions/11.26-deck-drawings/example-deck --out ../discussions/11.26-deck-drawings/reports/02_drawings-export-test --report ../discussions/11.26-deck-drawings/reports/02_drawings-export-test/02_drawings-export-test.md
    python scripts/deck_check.py ../discussions/11.26-deck-drawings/example-deck --url http://127.0.0.1:8911
