@echo off
echo ==========================================
echo Employee Monitoring Agent - Installer
echo ==========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python 3.8+ from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

echo Python found. Installing dependencies...
echo.

REM Install requirements
pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Installation complete!
echo ==========================================
echo.
echo NEXT STEPS:
echo 1. Edit config.json and add your API key
echo 2. Run: python employee_agent.py
echo.
echo To run at Windows startup:
echo - Press Win+R, type "shell:startup"
echo - Create a shortcut to employee_agent.py in that folder
echo.
pause
