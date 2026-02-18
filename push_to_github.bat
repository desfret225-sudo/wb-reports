@echo off
title GitHub Uploader & Deployer
echo ========================================
echo   Uploading and Deploying project...
echo ========================================

cd /d "%~dp0"

:: Initialize Git
if not exist ".git\" (
    echo Initializing Git repository...
    git init
)

:: Fix for "unable to auto-detect email"
echo Checking Git configuration...
git config user.email >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Setting temporary git user identity...
    git config user.email "user@example.com"
    git config user.name "User"
)

:: Add files
echo Adding files...
git add .

:: Commit
echo Committing changes...
git commit -m "Initial commit from Antigravity"

:: Set branch to main
git branch -M main

:: Add/Update remote
echo Setting remote origin to NEW REPOSITORY...
git remote remove origin 2>nul
git remote add origin https://github.com/desfret225-sudo/wb-reports.git

:: Push
echo Pushing to GitHub...
echo ----------------------------------------
echo IF A WINDOW POPS UP, PLEASE LOG IN TO GITHUB
echo ----------------------------------------
git push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCCESS] Project successfully uploaded!
    echo Check your repository: https://github.com/desfret225-sudo/wb-reports
) else (
    echo.
    echo [ERROR] Failed to upload. 
    echo Please make sure Git is installed and you are logged in.
)

pause
