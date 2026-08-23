@echo off
setlocal
title LOL Bingo POS
set "POS_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%POS_NODE%" (
  echo Node.js could not be found.
  echo Install Node.js from https://nodejs.org then run: npm run dev
  pause
  exit /b 1
)
start "" http://127.0.0.1:5187
"%POS_NODE%" "%~dp0server.js"
pause
