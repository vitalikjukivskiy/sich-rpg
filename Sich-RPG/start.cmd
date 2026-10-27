@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node.exe >nul 2>nul
if %errorlevel% equ 0 (
  node.exe server.mjs
) else if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.mjs
) else (
  echo Для запуску потрібен Node.js 22 або новіший.
  echo Установіть Node.js, потім відкрийте цей файл повторно.
)
pause
