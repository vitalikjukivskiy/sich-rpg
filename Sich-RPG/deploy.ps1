# «Січ: доба шаблі» — повне розгортання без втрати механік.
# Вимоги: Git, GitHub CLI (gh), Node.js (npx). Вхід у GitHub і Supabase проводиться в їхніх офіційних утилітах.
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
function Check($command,$hint) {
 if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Потрібен $command. $hint" }
}
Check 'git' 'Встановіть Git: https://git-scm.com/downloads'
Check 'gh' 'Встановіть GitHub CLI: https://cli.github.com/'
Check 'npx' 'Встановіть Node.js: https://nodejs.org/'
$repo='sich-rpg'
$project='zkhhmcsgdnufryyrcqwo'
Write-Host "`n=== 1. GitHub ===" -ForegroundColor Cyan
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) { & gh auth login; if($LASTEXITCODE -ne 0) {throw 'Не вдалося авторизувати GitHub.'} }
$owner=(& gh api user --jq .login).Trim()
if ($LASTEXITCODE -ne 0 -or -not $owner) { throw 'Не вдалося визначити акаунт GitHub.' }
$full="$owner/$repo"
& gh repo view $full *> $null
if ($LASTEXITCODE -eq 0) {
 throw "Репозиторій $full уже існує. Скрипт навмисно нічого не перезаписує."
}
Write-Host "`n=== 2. Supabase: сервер спільного світу ===" -ForegroundColor Cyan
& npx --yes supabase --version
if($LASTEXITCODE -ne 0){throw 'Не вдалося запустити Supabase CLI.'}
& npx --yes supabase login
if($LASTEXITCODE -ne 0){throw 'Не вдалося авторизувати Supabase.'}
& npx --yes supabase functions deploy sich-api --project-ref $project --no-verify-jwt
if($LASTEXITCODE -ne 0){throw 'Серверна функція не розгорнулася. Сайт не публікуємо, поки не виправимо.'}
Write-Host "`n=== 3. Завантаження ПОВНОЇ гри на GitHub ===" -ForegroundColor Cyan
if(Test-Path '.git'){throw 'Папка вже має Git-репозиторій. Перевірте вручну, щоб нічого не перезаписати.'}
& git init -b main
if($LASTEXITCODE -ne 0){throw 'Не вдалося ініціалізувати Git.'}
& git config user.name $owner
$uid=(& gh api user --jq .id).Trim()
& git config user.email "$uid+$owner@users.noreply.github.com"
& git add --all
& git commit -m 'Січ: повна RPG, мультиплеєр, Supabase та GitHub Pages'
if($LASTEXITCODE -ne 0){throw 'Не вдалося зберегти зміни в Git.'}
& gh repo create $full --public --source . --remote origin --push
if($LASTEXITCODE -ne 0){throw 'Не вдалося створити або завантажити репозиторій.'}
Write-Host "`n=== 4. Активація GitHub Pages ===" -ForegroundColor Cyan
& gh api -X POST "repos/$full/pages" -f build_type=workflow
if($LASTEXITCODE -ne 0){
 Write-Warning "Увімкніть Pages у Settings -> Pages -> Source: GitHub Actions: https://github.com/$full/settings/pages"
}
& gh workflow run pages.yml --repo $full
if($LASTEXITCODE -ne 0){Write-Warning "Запустіть Pages workflow вручну: https://github.com/$full/actions"}
$url="https://$owner.github.io/$repo/"
Write-Host "`nВідкрийте після успішного завершення Actions: $url" -ForegroundColor Green
Start-Process $url
