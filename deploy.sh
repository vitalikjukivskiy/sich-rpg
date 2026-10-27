#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
for bin in git gh node npx; do
  command -v "$bin" >/dev/null || { echo "Бракує $bin. GitHub CLI: https://cli.github.com; Node.js: https://nodejs.org"; exit 1; }
done
repo=sich-rpg
project=zkhhmcsgdnufryyrcqwo
gh auth status >/dev/null 2>&1 || gh auth login
owner="$(gh api user --jq .login)"
full="$owner/$repo"
if gh repo view "$full" >/dev/null 2>&1; then echo "Репозиторій $full уже існує — нічого не перезаписано."; exit 1; fi
npx --yes supabase login
npx --yes supabase functions deploy sich-api --project-ref "$project" --no-verify-jwt
if [[ -e .git ]]; then echo 'Знайдено інший .git; безпечна зупинка.'; exit 1; fi
git init -b main
git config user.name "$owner"
uid="$(gh api user --jq .id)"
git config user.email "$uid+$owner@users.noreply.github.com"
git add --all
git commit -m 'Січ: повна RPG, мультиплеєр, Supabase та GitHub Pages'
gh repo create "$full" --public --source . --remote origin --push
if ! gh api -X POST "repos/$full/pages" -f build_type=workflow; then
  echo "Увімкніть Pages: https://github.com/$full/settings/pages (Source: GitHub Actions)"
fi
gh workflow run pages.yml --repo "$full" || echo "Запуск вручну: https://github.com/$full/actions"
echo "Перевірте публікацію: https://$owner.github.io/$repo/"
