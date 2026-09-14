#!/usr/bin/env bash
# Runs the self-test build of the real iOS app on an iPhone and an iPad simulator
# (docs/13-platforms-and-testing.md). The app plays every game to its end by itself and prints
# SELFTEST lines to its console, which `simctl launch --console-pty` captures here.
set -uo pipefail

BUNDLE="app.gamepals.game"
APP="$(find apps/client/ios/build -type d -name 'App.app' -path '*iphonesimulator*' | head -1)"
SHOTS="apps/client/native-shots"
LIMIT=1500 # seconds per device
mkdir -p "$SHOTS"
[ -d "$APP" ] || { echo "No simulator build of App.app found"; exit 1; }

# First available simulator whose name starts with the given prefix (newest runtime first).
pick() {
  xcrun simctl list devices available -j | python3 -c "
import json, sys
devices = json.load(sys.stdin)['devices']
for runtime in sorted(devices, reverse=True):
    for d in devices[runtime]:
        if d['name'].startswith('$1'):
            print(d['udid'], d['name'], sep='|'); sys.exit(0)
"
}

status=0
for prefix in "iPhone 16" "iPad Pro"; do
  found="$(pick "$prefix")"
  [ -n "$found" ] || { echo "No simulator named $prefix*"; status=1; continue; }
  udid="${found%%|*}"; name="${found#*|}"
  slug="ios-$(echo "$name" | tr 'A-Z ' 'a-z-' | tr -cd 'a-z0-9-')"
  echo "== $name ($udid)"
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b >/dev/null
  xcrun simctl install "$udid" "$APP"

  logfile="$SHOTS/$slug.log"
  xcrun simctl launch --console-pty --terminate-running-process "$udid" "$BUNDLE" >"$logfile" 2>&1 &
  launcher=$!
  started=$(date +%s)
  shot=0
  while ! grep -qE "SELFTEST (PASS|FAIL)" "$logfile"; do
    now=$(date +%s)
    if [ $((now - started)) -gt $LIMIT ]; then echo "Timed out on $name"; break; fi
    if [ $(((now - started) / 120)) -ge "$shot" ]; then
      xcrun simctl io "$udid" screenshot "$SHOTS/$slug-$(printf %02d "$shot").png" >/dev/null 2>&1 || true
      shot=$((shot + 1))
    fi
    sleep 5
  done
  xcrun simctl io "$udid" screenshot "$SHOTS/$slug-end.png" >/dev/null 2>&1 || true
  kill "$launcher" 2>/dev/null || true
  grep "SELFTEST" "$logfile" | sed -E 's/^.*(SELFTEST)/\1/'
  grep -q "SELFTEST PASS" "$logfile" || status=1
  xcrun simctl shutdown "$udid" 2>/dev/null || true
done
exit $status
