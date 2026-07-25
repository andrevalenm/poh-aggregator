#!/usr/bin/env bash
#
# Start the unattended build loop on ax41. Run from this directory: bash go.sh
#
# Everything is already prepared and committed; this only does the parts that need a human
# to authorize them — pushing the latest harness over, creating the agent's unprivileged
# user, and launching the loop.
#
set -euo pipefail

echo "==> syncing repo to ax41"
rsync -az --exclude node_modules --exclude 'apps/demo/dist' --exclude cache --exclude out \
  ./ ax41:/root/poh-aggregator/

echo "==> clearing any dead session, then setting up the agent user"
ssh ax41 'tmux kill-session -t corroborate 2>/dev/null || true
su - corroborate -c "tmux kill-session -t corroborate" 2>/dev/null || true
bash /root/poh-aggregator/scripts/ax41-agent-setup.sh'

echo "==> starting the loop"
ssh ax41 'su - corroborate -c "tmux new -s corroborate -d ~/poh-aggregator/scripts/ax41-agent-loop.sh"'

sleep 12
echo "==> status"
ssh ax41 'su - corroborate -c "tmux ls"; echo; tail -30 /home/corroborate/corroborate-agent.log'

cat <<'EOF'

--------------------------------------------------------------------
Supervise:  ssh -t ax41 'su - corroborate -c "tmux attach -t corroborate"'
            (detach with ctrl-b then d)
Log:        ssh ax41 'tail -f /home/corroborate/corroborate-agent.log'
Commits:    ssh ax41 'cd /home/corroborate/poh-aggregator && git log --oneline -20'
Stop:       ssh ax41 'su - corroborate -c "tmux kill-session -t corroborate"'
--------------------------------------------------------------------
EOF
