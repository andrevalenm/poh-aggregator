#!/usr/bin/env bash
#
# Autonomous build loop for ax41. Each iteration is a FRESH Claude Code context that reads
# MISSION.md and PROGRESS.md, does one increment, commits, and logs what it did. Fresh
# contexts on purpose: no context-window exhaustion, and a crashed iteration costs one
# increment rather than the whole run.
#
# Must NOT run as root: `--dangerously-skip-permissions` refuses to start under root or
# sudo. That restriction is also a favour here — this box hosts unrelated production apps,
# so the agent gets its own unprivileged user and cannot reach them.
#
#   start:   tmux new -s corroborate -d "$HOME/poh-aggregator/scripts/ax41-agent-loop.sh"
#   watch:   tmux attach -t corroborate     (detach with ctrl-b then d)
#   log:     tail -f ~/corroborate-agent.log
#   stop:    tmux kill-session -t corroborate
#
set -uo pipefail

if [ "$(id -u)" = "0" ]; then
  echo "refusing to run as root: claude --dangerously-skip-permissions will not start." >&2
  echo "run this as an unprivileged user that owns the repo." >&2
  exit 1
fi

# Derive the repo from this script's location so the loop works from any home directory.
REPO=${REPO:-$(cd "$(dirname "$0")/.." && pwd)}
LOG=${LOG:-$HOME/corroborate-agent.log}
MAX_ITER=${MAX_ITER:-60}
ITER_TIMEOUT=${ITER_TIMEOUT:-5400}   # 90 min ceiling per iteration
PAUSE=${PAUSE:-20}

cd "$REPO" || exit 1

say() { printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

BARREN=0

say "=== loop starting as $(id -un) in ${REPO}: max ${MAX_ITER} iterations, model claude-opus-5 ==="

for i in $(seq 1 "$MAX_ITER"); do
  say "--- iteration ${i}/${MAX_ITER} begin ---"

  # Guard: a dirty tree from a killed iteration would make the next one build on sand.
  if [ -n "$(git status --porcelain)" ]; then
    say "tree dirty at iteration start — committing as WIP so the next iteration is clean"
    git add -A && git commit -q -m "wip: uncommitted work salvaged at iteration ${i} start" || true
  fi

  BEFORE=$(git rev-parse HEAD)

  timeout "$ITER_TIMEOUT" claude \
      --dangerously-skip-permissions \
      --model claude-opus-5 \
      -p "You are iteration ${i} of an unattended build loop. Your standing brief is
MISSION.md in this repository — read it in full before acting, and read PROGRESS.md to see
what previous iterations already finished so you do not redo it.

Then: pick the SINGLE highest-priority incomplete item from the queue, implement it
completely, run its tests, commit it with a real message, and append your iteration block to
PROGRESS.md. One solid finished increment beats three half-finished ones.

If the item you picked turns out to be blocked, say so in PROGRESS.md, note anything needing
Hugo in MORNING.md, and move to the next item rather than stalling." \
      2>&1 | tee -a "$LOG"
  rc=${PIPESTATUS[0]}

  AFTER=$(git rev-parse HEAD)
  if [ "$BEFORE" = "$AFTER" ]; then
    BARREN=$((BARREN + 1))
    say "iteration ${i} finished (exit ${rc}) but produced NO commit (${BARREN} in a row)"
    # Circuit breaker. A misconfiguration — bad credentials, a refused flag, a missing
    # binary — fails instantly and identically every time, and without this the loop
    # cheerfully burns every remaining iteration on it. Three barren rounds means the
    # problem is the setup, not the task.
    if [ "$BARREN" -ge 3 ]; then
      say "!!! three barren iterations in a row — stopping. Last 40 log lines:"
      tail -40 "$LOG"
      exit 1
    fi
  else
    BARREN=0
    say "iteration ${i} finished (exit ${rc}): $(git log --oneline "${BEFORE}..${AFTER}" | wc -l) commit(s)"
    git log --oneline "${BEFORE}..${AFTER}" | tee -a "$LOG"
  fi

  sleep "$PAUSE"
done

say "=== loop complete after ${MAX_ITER} iterations ==="
