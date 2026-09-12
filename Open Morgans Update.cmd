@echo off
setlocal
set ELECTRON_RUN_AS_NODE=
set SUNNY_DATA_DIR=
start "" "%~dp0release-morgans\win-unpacked\Sunny HQ.exe" "--import-briefing=%~dp0.sunny-dev\morgans-first-capture.json"
endlocal
