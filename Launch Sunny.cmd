@echo off
set "ELECTRON_RUN_AS_NODE="
set "SUNNY_DEV_URL="
set "SUNNY_DATA_DIR=%LOCALAPPDATA%\Sunny HQ"
set "SUNNY_RELEASE=%~dp0.sunny-dev\validated-release-integration-2026-09-22\win-unpacked\Sunny HQ.exe"
if not exist "%SUNNY_RELEASE%" set "SUNNY_RELEASE=%~dp0release-workflow-0.11.0\win-unpacked\Sunny HQ.exe"
if not exist "%SUNNY_RELEASE%" set "SUNNY_RELEASE=%~dp0release\win-unpacked\Sunny HQ.exe"
if exist "%SUNNY_RELEASE%" (
  start "Sunny HQ" "%SUNNY_RELEASE%"
) else (
  echo The verified Sunny package is missing. Existing releases and user data are preserved.
  pause
)
