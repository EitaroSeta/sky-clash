@echo off
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  python serve.py
) else (
  echo Python was not found. Opening the offline PC game.
  start "" "%~dp0index.html"
)
pause
