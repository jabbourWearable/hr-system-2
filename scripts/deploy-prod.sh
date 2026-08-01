#!/usr/bin/env bash
# Manual production deploy wrapper (Vercel project is not Git-connected — see
# ARCHITECTURE.md "Vercel deploy guard (HR-73)"). Tags the deploy with the
# commit SHA via DEPLOY_COMMIT_SHA and smoke-checks /api/version afterwards so
# a bad deploy fails loudly here instead of silently serving stale code.
set -euo pipefail

BASE_URL="${BASE_URL:-https://hr-system-2-iota.vercel.app}"

git fetch origin main
LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse origin/main)
if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
  echo "ERROR: HEAD ($LOCAL_SHA) is not origin/main ($REMOTE_SHA)." >&2
  echo "Deploy from an up-to-date main, not a feature branch or stale checkout." >&2
  exit 1
fi

echo "Deploying commit $LOCAL_SHA to production..."
vercel --prod --yes \
  --build-env "DEPLOY_COMMIT_SHA=$LOCAL_SHA" \
  -e "DEPLOY_COMMIT_SHA=$LOCAL_SHA" \
  -e "DEPLOY_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "Smoke-checking $BASE_URL/api/version..."
DEPLOYED_SHA=$(curl -fsS "$BASE_URL/api/version" | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).commit || ''))")
if [ "$DEPLOYED_SHA" != "$LOCAL_SHA" ]; then
  echo "ERROR: production /api/version reports '$DEPLOYED_SHA', expected '$LOCAL_SHA'." >&2
  echo "The deploy did not go live as expected — investigate before considering this done." >&2
  exit 1
fi
echo "OK: production is serving $LOCAL_SHA"
