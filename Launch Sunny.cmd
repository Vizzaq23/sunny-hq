@echo off
set "ELECTRON_RUN_AS_NODE="
set "SUNNY_DEV_URL="
set "SUNNY_DATA_DIR=%LOCALAPPDATA%\Sunny HQ"
if exist "%~dp0.sunny-dev\validated-release-renderer-recovery-2026-09-23\win-unpacked\Sunny HQ.exe" (
  start "Sunny HQ" "%~dp0.sunny-dev\validated-release-renderer-recovery-2026-09-23\win-unpacked\Sunny HQ.exe"
) else (
  echo The verified Sunny update is missing. Previous packages and profile backups are preserved.
  pause
)
