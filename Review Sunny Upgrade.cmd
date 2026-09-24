@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
set "SUNNY_REVIEW_DATA_DIR=%~dp0.sunny-dev\prepared-upgrade-0.11.0\.sunny-dev\review-profile"
set "SUNNY_DEV_URL="
start "Sunny HQ Upgrade Preview" /D "%~dp0.sunny-dev\prepared-upgrade-0.11.0" "%~dp0.sunny-dev\prepared-upgrade-0.11.0\release\win-unpacked\Sunny HQ.exe" --review-preview
endlocal
