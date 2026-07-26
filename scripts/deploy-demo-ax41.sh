#!/usr/bin/env bash
# Deploy the demo to ax41 (Hetzner). Non-invasive: standalone nginx container on :8788,
# no changes to the dokploy/traefik stack that owns 80/443. Remove with:
#   ssh ax41 'docker rm -f corroborate-demo'
set -euo pipefail
cd "$(dirname "$0")/../apps/demo"
VITE_SUBGRAPH_URL=https://api.studio.thegraph.com/query/77602/poh/version/latest npx vite build
ssh ax41 'mkdir -p ~/corroborate-demo/dist'
rsync -az --delete dist/ ax41:corroborate-demo/dist/

# nginx conf: stock nginx:alpine ships gzip OFF — the 332KB viem chunk went over the wire
# uncompressed. Also: hashed /assets and /fonts are immutable, cache them as such.
ssh ax41 'cat > ~/corroborate-demo/nginx.conf' << 'CONF'
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  gzip on;
  gzip_comp_level 6;
  gzip_min_length 1024;
  gzip_vary on;
  gzip_types application/javascript text/css application/json image/svg+xml text/plain;

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location /fonts/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location / {
    try_files $uri $uri/ =404;
  }
}
CONF

ssh ax41 'docker rm -f corroborate-demo 2>/dev/null; docker run -d --name corroborate-demo \
  --restart unless-stopped -p 8788:80 \
  -v $HOME/corroborate-demo/dist:/usr/share/nginx/html:ro \
  -v $HOME/corroborate-demo/nginx.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine'

# Recreating the container drops every network it was attached to except the default bridge,
# so traefik loses the ability to resolve `corroborate-demo` by name and print.observer starts
# answering 502. That is exactly what happened on the deploy of 2026-07-26. Reattaching here
# makes the deploy idempotent instead of quietly taking the domain down.
ssh ax41 'docker network connect dokploy-network corroborate-demo 2>/dev/null || true
docker inspect corroborate-demo --format "attached networks: {{range \$k,\$v := .NetworkSettings.Networks}}{{\$k}} {{end}}"'

# Fail loudly rather than reporting success while the public domain is broken.
for i in 1 2 3 4 5 6; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    --resolve print.observer:443:37.27.67.44 https://print.observer/ || true)
  [ "$code" = "200" ] && break
  sleep 3
done
echo "http://37.27.67.44:8788  |  https://print.observer -> ${code:-no answer}"
[ "${code:-}" = "200" ] || { echo "WARNING: print.observer is not serving 200" >&2; exit 1; }
