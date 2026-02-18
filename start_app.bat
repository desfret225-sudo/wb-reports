@echo off
title WB Analyst Multi Runner
echo ========================================
echo   Launching WB Analyst Multi...
echo ========================================

cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules\" (
    echo [ERROR] node_modules folder not found.
    echo Installing dependencies... this may take a moment.
    call npm install
)

echo Starting developer server...
call npm run dev

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Application failed to start.
    echo Please check if Node.js is installed and the path is correct.
    pause
)

pause
