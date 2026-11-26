#!/usr/bin/env bash
# Runs both scripts on the Orbit demo, before and fixed, one browser at a time.
# usage: bash run-all.sh   (from anywhere; the demo server must be up on 4517)
set -u
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
cd /c/dev/skills/screen-fit/scripts
OUT=../demo/out/mobile
COMMON="WEB_URL=http://127.0.0.1:4517 VIEWPORTS=phone,compact,phoneWide,tabletUp MARK=true EMPTY_BAND=off MIN_BUTTON_PCT=3 FULL_PAGE=true"
env $COMMON ROUTES='/board.html,/board.html?tab=reports' OUT_DIR=$OUT/before/screen-fit npx tsx screen-fit.ts > $OUT/before-screen-fit.log 2>&1; echo "before screen-fit exit $?"
env $COMMON ROUTES='/board.html?fixed,/board.html?tab=reports&fixed' OUT_DIR=$OUT/after/screen-fit npx tsx screen-fit.ts > $OUT/after-screen-fit.log 2>&1; echo "after screen-fit exit $?"
M="WEB_URL=http://127.0.0.1:4517 VIEWPORTS=320x568,360x640,568x320,667x375 MARK=true"
env $M CASES=../demo/cases.before.json OUT_DIR=$OUT/before/modal-fit npx tsx modal-fit.ts > $OUT/before-modal-fit.log 2>&1; echo "before modal-fit exit $?"
env $M CASES=../demo/cases.after.json OUT_DIR=$OUT/after/modal-fit npx tsx modal-fit.ts > $OUT/after-modal-fit.log 2>&1; echo "after modal-fit exit $?"
