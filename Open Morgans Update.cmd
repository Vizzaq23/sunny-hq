@echo off
setlocal
set ELECTRON_RUN_AS_NODE=
set SUNNY_DATA_DIR=
if exist "%~dp0release-workflow-0.11.0\win-unpacked\Sunny HQ.exe" (
  start "" "%~dp0release-workflow-0.11.0\win-unpacked\Sunny HQ.exe" "--import-briefing=%~dp0.sunny-dev\morgans-first-capture.json"
) else (
  start "" "%~dp0release-morgans\win-unpacked\Sunny HQ.exe" "--import-briefing=%~dp0.sunny-dev\morgans-first-capture.json"
)
endlocal
