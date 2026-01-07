@echo off
:: ============================================
:: Employee Monitor Agent - One-Click Setup
:: ============================================
:: Double-click this file to install the agent
:: ============================================

echo.
echo Starting one-click installation...
echo.

:: Run PowerShell installer with bypass policy
powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1"

:: If PowerShell fails, show message
if errorlevel 1 (
    echo.
    echo ============================================
    echo   Installation encountered an issue
    echo ============================================
    echo.
    echo If you see an error, try running as Administrator:
    echo   Right-click setup.bat ^> Run as administrator
    echo.
    pause
)
