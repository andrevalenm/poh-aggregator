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
echo "live at http://37.27.67.44:8788"
