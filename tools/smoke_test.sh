#!/usr/bin/env bash
# Headless smoke test: plays ~2.5 minutes of game time with the autoplay bot
# and fails if any script error is logged or no run completes.
# Usage: GODOT=/path/to/godot tools/smoke_test.sh
set -euo pipefail
GODOT="${GODOT:-godot}"
cd "$(dirname "$0")/.."
"$GODOT" --headless --editor --quit >/dev/null 2>&1 || true
LOG="$(mktemp)"
"$GODOT" --headless --fixed-fps 60 --quit-after 9000 res://scenes/game.tscn -- --autoplay 2>&1 | tee "$LOG" | grep -E "RUN_OVER|LANDED" || true
if grep -qE "SCRIPT ERROR|Parse Error" "$LOG"; then
  echo "FAIL: script errors"; grep -E "SCRIPT ERROR|Parse Error" "$LOG"; exit 1
fi
grep -q "RUN_OVER" "$LOG" || { echo "FAIL: no run completed"; exit 1; }
echo "PASS"
