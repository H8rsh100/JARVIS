@echo off
cd /d "%~dp0"
title JARVIS
setlocal EnableExtensions

echo.
echo  J.A.R.V.I.S.
echo.

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm not found.
  pause
  exit /b 1
)

REM --- FAST PATH: already warm? open window only ---
powershell -NoProfile -Command "try{$w=Invoke-WebRequest -Uri http://127.0.0.1:3000/ -UseBasicParsing -TimeoutSec 1; $a=Invoke-WebRequest -Uri http://127.0.0.1:3847/health -UseBasicParsing -TimeoutSec 1; if($w.StatusCode -eq 200 -and $a.StatusCode -eq 200){exit 0}else{exit 1}}catch{exit 1}"
if not errorlevel 1 (
  echo Systems already online - opening window...
  taskkill /F /IM electron.exe >nul 2>nul
  set JARVIS_UI_ONLY=1
  start "JARVIS" cmd /c "cd /d C:\PROJECTS\JARVIS && set JARVIS_UI_ONLY=1 && pnpm --filter @jarvis/host start"
  echo Ready.
  exit /b 0
)

echo Cold start - using fast production server...
taskkill /F /IM electron.exe >nul 2>nul

REM Only kill listeners on our ports (not every node on the machine)
powershell -NoProfile -Command "$ports=3000,3847; foreach($p in $ports){ Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"

timeout /t 1 /nobreak >nul

if not exist "apps\web\.next\BUILD_ID" (
  echo Building once for speed - next launches will be fast...
  call pnpm --filter @jarvis/web build
  if errorlevel 1 (
    echo Build failed - falling back to dev mode.
    goto DEV_FALLBACK
  )
)

start "JARVIS-AGENT" cmd /c "cd /d C:\PROJECTS\JARVIS && pnpm agent"
start "JARVIS-WEB" cmd /c "cd /d C:\PROJECTS\JARVIS && pnpm --filter @jarvis/web start"

echo Waiting max ~5s for UI...
powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 12;$i++){ try { $r=Invoke-WebRequest -Uri http://127.0.0.1:3000/ -UseBasicParsing -TimeoutSec 1; if($r.StatusCode -eq 200){ $ok=$true; break } } catch {}; Start-Sleep -Milliseconds 400 }; if($ok){ exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo Still warming - opening window anyway. It will attach when ready.
)

set JARVIS_UI_ONLY=1
start "JARVIS" cmd /c "cd /d C:\PROJECTS\JARVIS && set JARVIS_UI_ONLY=1 && pnpm --filter @jarvis/host start"
echo Launched.
exit /b 0

:DEV_FALLBACK
start "JARVIS-AGENT" cmd /c "cd /d C:\PROJECTS\JARVIS && pnpm agent"
start "JARVIS-WEB" cmd /c "cd /d C:\PROJECTS\JARVIS && pnpm --filter @jarvis/web dev"
timeout /t 8 /nobreak >nul
set JARVIS_UI_ONLY=1
start "JARVIS" cmd /c "cd /d C:\PROJECTS\JARVIS && set JARVIS_UI_ONLY=1 && pnpm --filter @jarvis/host start"
exit /b 0
