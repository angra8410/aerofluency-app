@echo off
title AeroFluency Launcher
echo ===================================================
echo   AeroFluency Launcher (B2-to-C1 deliberate practice)
echo ===================================================
echo.

echo [1/2] Starting offline Speech-to-Text Bridge...
start "AeroFluency STT Server" cmd /k "python ..\stt_server.py"

echo [2/2] Starting Vite Development Server...
echo.
npm run dev
