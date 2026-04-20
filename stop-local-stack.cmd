@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-local-stack.ps1" %*
exit /b %errorlevel%
