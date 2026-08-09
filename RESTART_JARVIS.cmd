@echo off
cd /d "%~dp0"
echo.
echo  JARVIS SAFE RESTART
echo  Your project files are fine. This only restarts servers.
echo.

echo Closing old Node / Electron...
taskkill /F /IM electron.exe >nul 2>nul
taskkill /F /IM node.exe >nul 2>nul
timeout /t 2 /nobreak >nul

echo Starting desktop agent in a new window...
start "JARVIS-AGENT" cmd /k "cd /d C:\PROJECTS\JARVIS && pnpm agent"

timeout /t 2 /nobreak >nul

echo Starting web UI in a new window...
start "JARVIS-WEB" cmd /k "cd /d C:\PROJECTS\JARVIS && pnpm --filter @jarvis/web dev"

echo.
echo Waiting 8 seconds for Next to boot...
timeout /t 8 /nobreak >nul

echo Opening Chrome...
start "" "http://127.0.0.1:3000"

echo.
echo If the page is blank, wait 10 more seconds and press F5.
echo Keep the two JARVIS-AGENT and JARVIS-WEB windows open.
echo.
pause
