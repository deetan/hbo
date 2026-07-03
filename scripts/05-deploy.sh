#!/usr/bin/env bash
# STEP 5: deploy the catalogue to https://den.tanaev.su/hbo/  (nginx static, ssh alias 'reports').
# Drops files into a subdir of the existing web root — no nginx config change.
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ssh reports 'mkdir -p /opt/den-tanaev/public/hbo'
rsync -az "$DIR/site/index.html" "$DIR/site/catalog.json" reports:/opt/den-tanaev/public/hbo/
ssh reports 'chmod 755 /opt/den-tanaev/public/hbo && chmod 644 /opt/den-tanaev/public/hbo/*'
echo "deployed -> https://den.tanaev.su/hbo/"
curl -s -o /dev/null -w "  /hbo/ -> %{http_code}  catalog.json -> " https://den.tanaev.su/hbo/
curl -s -o /dev/null -w "%{http_code}\n" https://den.tanaev.su/hbo/catalog.json
