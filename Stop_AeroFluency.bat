@echo off
title Stop AeroFluency
echo ===================================================
echo   Stopping AeroFluency Background Processes...
echo ===================================================
echo.
taskkill /f /im node.exe >nul 2>&1
wmic process where "CommandLine like '%%stt_server.py%%'" Call Terminate >nul 2>&1
echo AeroFluency servers stopped successfully.
echo.
pause
