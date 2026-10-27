СІЧ: ДОБА ШАБЛІ — BETA 0.2

У PowerShell:
cd "$HOME\Downloads"
Expand-Archive ".\Sich-RPG-Beta-0.2-FINAL.zip" ".\Sich-RPG-Beta-0.2" -Force
powershell -NoProfile -ExecutionPolicy Bypass -File ".\Sich-RPG-Beta-0.2\Sich-RPG\deploy.ps1"

Скрипт запускатиме тести, оновить Supabase API і завантажить фронтенд на GitHub.
Прочитайте BETA02-REPORT.md для інформації про обмеження цієї версії.
