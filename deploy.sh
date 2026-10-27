#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
for cmd in gh git node npm npx; do command -v "$cmd" >/dev/null || { echo "Missing: $cmd"; exit 1; }; done
OWNER=$(gh api user --jq .login)
[ "$OWNER" = "vitalikjukivskiy" ] || { echo "Wrong GitHub account: $OWNER"; exit 1; }
node scripts/sync-edge-engine.mjs
npm test
npx --yes supabase functions deploy sich-api --project-ref zkhhmcsgdnufryyrcqwo --no-verify-jwt
TMP=$(mktemp -d)
gh repo clone vitalikjukivskiy/sich-rpg "$TMP"
rsync -a --exclude .git --exclude node_modules --exclude data ./ "$TMP/"
cd "$TMP"
git config user.name "$OWNER"
UID_GH=$(gh api user --jq .id)
git config user.email "$UID_GH+$OWNER@users.noreply.github.com"
git add -A
if ! git diff --cached --quiet; then
 git commit -m 'Beta 0.2: balanced classes, timed combat, market floors, UI'
 git push origin HEAD:main
fi
echo 'Submitted to GitHub Pages. Check Actions: https://github.com/vitalikjukivskiy/sich-rpg/actions'
