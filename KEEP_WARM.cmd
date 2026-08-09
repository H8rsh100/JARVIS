@echo off
cd /d "%~dp0"
title JARVIS keep-warm
echo Keeping JARVIS agent + UI warm in the background.
echo Run START_JARVIS.cmd anytime - it will open in ~1-2 seconds.
echo.

taskkill /F /IM electron.exe >nul 2>nul
powershell -NoProfile -Command "$ports=3000,3847; foreach($p in $ports){ Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"
timeout /t 1 /nobreak >nul

REM Rebuild when missing, or when FORCE_REBUILD=1 (date/time & UI changes need this)
if "%FORCE_REBUILD%"=="1" (
  echo Force rebuilding UI...
  call pnpm --filter @jarvis/web build
) else if not exist "apps\web\.next\BUILD_ID" (
  echo Building once...
  call pnpm --filter @jarvis/web build
)

start "JARVIS-AGENT" /MIN cmd /c "cd /d C:\PROJECTS\JARVIS && pnpm agent"
start "JARVIS-WEB" /MIN cmd /c "cd /d C:\PROJECTS\JARVIS && pnpm --filter @jarvis/web start"

echo Warm. You can close this launcher window.
timeout /t 3 /nobreak >nul
