# PowerShell 5.1 compatible. Saved with UTF-8 BOM in release ZIP.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
foreach ($tool in @('gh','git','node','npx')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing executable: $tool" }
}
$repo='vitalikjukivskiy/sich-rpg'
$project='zkhhmcsgdnufryyrcqwo'
# Do not let a nonzero status of a native command terminate the PowerShell script prematurely.
cmd /c 'gh auth status >nul 2>nul'
if ($LASTEXITCODE -ne 0) { & gh auth login; if($LASTEXITCODE -ne 0){throw 'GitHub authorization failed.'} }
$who=(& gh api user --jq .login).Trim()
if($who -ne 'vitalikjukivskiy'){ throw "Wrong GitHub account: $who. Expected vitalikjukivskiy" }
& node scripts/sync-edge-engine.mjs
if($LASTEXITCODE -ne 0){throw 'Engine sync failed.'}
& npm test
if($LASTEXITCODE -ne 0){throw 'Tests failed; nothing deployed.'}
Write-Host '=== Updating Supabase API ===' -ForegroundColor Cyan
& npx --yes supabase functions deploy sich-api --project-ref $project --no-verify-jwt
if($LASTEXITCODE -ne 0){throw 'Supabase deploy failed. Frontend not published.'}
Write-Host '=== Updating GitHub Pages ===' -ForegroundColor Cyan
$temp=Join-Path $env:TEMP ('sich-beta02-'+[guid]::NewGuid().ToString('N'))
& gh repo clone $repo $temp
if($LASTEXITCODE -ne 0){throw 'GitHub clone failed.'}
Get-ChildItem -LiteralPath $PSScriptRoot -Force | Where-Object { $_.Name -notin @('.git','data','node_modules') } | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $temp -Recurse -Force
}
Push-Location $temp
try {
 & git config user.name $who
 $uid=(& gh api user --jq .id).Trim()
 & git config user.email "$uid+$who@users.noreply.github.com"
 & git add -A
 & git diff --cached --quiet
 if($LASTEXITCODE -ne 0){
  & git commit -m 'Beta 0.2: balanced classes, timed combat, market floors, UI'
  if($LASTEXITCODE -ne 0){throw 'Git commit failed.'}
  & git push origin HEAD:main
  if($LASTEXITCODE -ne 0){throw 'GitHub push failed.'}
 }
} finally { Pop-Location }
Write-Host 'Submitted to Pages: https://vitalikjukivskiy.github.io/sich-rpg/' -ForegroundColor Green
Write-Host 'Verify GitHub Actions is green before sharing the game.'
