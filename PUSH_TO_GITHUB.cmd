@echo off
title Pushing ASHFALL to GitHub
color 0A
echo ========================================================
echo       ASHFALL - Pushing project to GitHub...
echo ========================================================
echo.
cd /d "%~dp0"
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo  [SUCCESS] All files and commits pushed to GitHub!
    echo ========================================================
) else (
    echo ========================================================
    echo  [NOTICE] If a browser window opened, please authorize
    echo  GitHub to complete the push.
    echo ========================================================
)
echo.
pause
