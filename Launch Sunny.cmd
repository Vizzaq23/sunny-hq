@echo off
set "ELECTRON_RUN_AS_NODE="
set "SUNNY_DEV_URL="
set "SUNNY_DATA_DIR=%LOCALAPPDATA%\Sunny HQ"
set "SUNNY_MORGANS_INBOX=%~dp0.sunny-dev\morgans-inbox"
powershell.exe -NoProfile -Command "if (Get-Process -Name 'Sunny HQ' -ErrorAction SilentlyContinue) { exit 1 }"
if errorlevel 1 (
  echo Sunny HQ is still running. Finish any active work and choose Quit from its tray menu, then launch this update.
  pause
  exit /b 1
)
if exist "%~dp0.sunny-dev\validated-release-morgans-chatgpt-2026-09-29-final\win-unpacked\Sunny HQ.exe" (
  start "Sunny HQ" "%~dp0.sunny-dev\validated-release-morgans-chatgpt-2026-09-29-final\win-unpacked\Sunny HQ.exe"
) else (
  echo The verified Sunny update is missing. Previous packages and profile backups are preserved.
  pause
)
