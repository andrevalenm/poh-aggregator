#!/usr/bin/env bash
#
# Autonomous build loop for ax41. Each iteration is a FRESH Claude Code context that reads
# MISSION.md and PROGRESS.md, does one increment, commits, and logs what it did. Fresh
# contexts on purpose: no context-window exhaustion, and a crashed iteration costs one
# increment rather than the whole run.
#
#   start:   tmux new -s corroborate -d '/root/poh-aggregator/scripts/ax41-agent-loop.sh'
#   watch:   tmux attach -t corroborate     (detach with ctrl-b then d)
#   log:     tail -f /root/corroborate-agent.log
#   stop:    tmux kill-session -t corroborate
#
set -uo pipefail

REPO=/root/poh-aggregator
LOG=/root/corroborate-agent.log
MAX_ITER=${MAX_ITER:-60}
ITER_TIMEOUT=${ITER_TIMEOUT:-5400}   # 90 min ceiling per iteration
PAUSE=${PAUSE:-20}

cd "$REPO" || exit 1

say() { printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

say "=== loop starting: max ${MAX_ITER} iterations, model claude-opus-5 ==="

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
      >>"$LOG" 2>&1
  rc=$?

  AFTER=$(git rev-parse HEAD)
  if [ "$BEFORE" = "$AFTER" ]; then
    say "iteration ${i} finished (exit ${rc}) but produced NO commit — check the log"
  else
    say "iteration ${i} finished (exit ${rc}): $(git log --oneline "${BEFORE}..${AFTER}" | wc -l) commit(s)"
    git log --oneline "${BEFORE}..${AFTER}" | tee -a "$LOG"
  fi

  sleep "$PAUSE"
done

say "=== loop complete after ${MAX_ITER} iterations ==="
