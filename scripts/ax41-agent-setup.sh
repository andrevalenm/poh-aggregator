#!/usr/bin/env bash
#
# One-time setup, run AS ROOT on ax41. Creates the unprivileged user the build loop runs as.
#
# Why not just run as root: `claude --dangerously-skip-permissions` refuses to start under
# root or sudo. That is also the right outcome here — this machine hosts unrelated production
# apps (dokploy, peanut-split, wordle, payoff, findjuris, uptime-kuma), and an unattended
# agent has no business being able to reach them. The agent user is deliberately NOT in the
# docker group: deploying subgraphs to the existing graph-node happens over HTTP, so it does
# not need one.
#
#   ssh ax41 'bash /root/poh-aggregator/scripts/ax41-agent-setup.sh'
#
set -euo pipefail

USER_NAME=corroborate
USER_HOME=/home/$USER_NAME
SRC=/root/poh-aggregator

[ "$(id -u)" = "0" ] || { echo "run this as root" >&2; exit 1; }
[ -d "$SRC" ] || { echo "missing $SRC — rsync the repo first" >&2; exit 1; }

if id "$USER_NAME" >/dev/null 2>&1; then
  echo "user $USER_NAME already exists — reusing it"
else
  useradd -m -s /bin/bash "$USER_NAME"
  echo "created user $USER_NAME"
fi

# Repo. Copy rather than move, so /root keeps a pristine reference of the handover state.
rm -rf "$USER_HOME/poh-aggregator"
cp -a "$SRC" "$USER_HOME/poh-aggregator"

# Claude Code credentials and config. The credential file is the only secret here; the
# others just prevent first-run onboarding from blocking a headless invocation.
mkdir -p "$USER_HOME/.claude"
cp /root/.claude/.credentials.json "$USER_HOME/.claude/.credentials.json"
[ -f /root/.claude/settings.json ] && cp /root/.claude/settings.json "$USER_HOME/.claude/settings.json"
[ -f /root/.claude.json ] && cp /root/.claude.json "$USER_HOME/.claude.json"

chown -R "$USER_NAME:$USER_NAME" "$USER_HOME"
chmod 700 "$USER_HOME/.claude"
chmod 600 "$USER_HOME/.claude/.credentials.json"
chmod +x "$USER_HOME/poh-aggregator/scripts/ax41-agent-loop.sh"

# git refuses to operate on a tree it thinks belongs to someone else.
su - "$USER_NAME" -c "git config --global --add safe.directory $USER_HOME/poh-aggregator"
su - "$USER_NAME" -c "git config --global user.name 'Corroborate Agent'"
su - "$USER_NAME" -c "git config --global user.email 'agent@localhost'"

echo "--- preflight ---"
su - "$USER_NAME" -c 'printf "whoami: "; id -un
printf "node:   "; node --version
printf "pnpm:   "; command -v pnpm >/dev/null && pnpm --version || echo MISSING
printf "claude: "; claude --version
printf "git:    "; cd ~/poh-aggregator && git log --oneline -1'

echo
echo "--- auth + model check (headless, non-root) ---"
su - "$USER_NAME" -c 'cd ~/poh-aggregator && timeout 120 claude --dangerously-skip-permissions --model claude-opus-5 -p "Reply with exactly: READY" 2>&1 | tail -3'

echo
echo "Setup done. Start the loop with:"
echo "  su - $USER_NAME -c 'tmux new -s corroborate -d ~/poh-aggregator/scripts/ax41-agent-loop.sh'"
