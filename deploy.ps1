# Beta 0.2: update an existing sich-rpg repository without recreating it.
$ErrorActionPreference='Stop'
& "$PSScriptRoot\UPDATE-BETA-0.2.ps1"
if($LASTEXITCODE -ne 0){throw 'Beta 0.2 deploy failed.'}
