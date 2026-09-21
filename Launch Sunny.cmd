@echo off
set "ELECTRON_RUN_AS_NODE="
if exist "%~dp0release-workflow-0.11.0\win-unpacked\Sunny HQ.exe" (
  start "Sunny HQ" "%~dp0release-workflow-0.11.0\win-unpacked\Sunny HQ.exe"
) else (
  start "Sunny HQ" "%~dp0release\win-unpacked\Sunny HQ.exe"
)
