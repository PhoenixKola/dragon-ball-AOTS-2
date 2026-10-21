@echo off
setlocal
cd /d "%~dp0"
title Attack of the Saiyans II - Namek Saga
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run the local game server.
  echo Install Node.js 20 or newer from https://nodejs.org/  then run this file again.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo First run: building the game once. This needs "npm install" to have been run.
  if not exist "node_modules" ( call npm install ) 
  call npm run build
  if errorlevel 1 ( echo Build failed. See README.md troubleshooting. & pause & exit /b 1 )
)
rem Create or refresh a launcher shortcut with the game icon (pin it to the taskbar for a reliable icon).
if exist "public\icon.ico" powershell -NoProfile -Command "try { $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path '%~dp0' 'Attack of the Saiyans II.lnk')); $s.TargetPath='%~dp0START_GAME.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0public\icon.ico'; $s.WindowStyle=7; $s.Save() } catch {}" >nul 2>nul
echo.
echo  ATTACK OF THE SAIYANS II - THE NAMEK SAGA
echo  Starting local server (offline, 127.0.0.1 only). Keep this window open while playing.
set "AOTS_URL=http://127.0.0.1:5173"
set "AOTS_BROWSER="
for %%P in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe") do if exist %%P if not defined AOTS_BROWSER set "AOTS_BROWSER=%%~P"
if not defined AOTS_BROWSER goto plainbrowser
rem Chrome or Edge app window in full screen. Press F in the game to leave or re-enter full screen.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 2; Start-Process -FilePath '%AOTS_BROWSER%' -ArgumentList '--app=%AOTS_URL%','--start-fullscreen'"
goto serve
:plainbrowser
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 2; Start-Process '%AOTS_URL%'"
:serve
node tools\serve-dist.mjs
pause
