@echo off
cd /d "%~dp0"
echo.
echo  J.A.R.V.I.S. starting...
echo  Keep this window open. Quit from the tray when done.
echo.
pnpm jarvis
if errorlevel 1 (
  echo.
  echo JARVIS failed. Try: pnpm install
  pause
)
