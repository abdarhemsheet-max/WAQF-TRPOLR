@echo off
chcp 65001 >nul 2>nul
title Waqf TRPOLR - WhatsApp Sender
color 0A

set SENDER_DIR=whatsapp-sender
set SERVER_JS=%SENDER_DIR%\server.js
set PORT=3330

cls
echo.
echo ==============================================
echo       Waqf TRPOLR - WhatsApp Sender
echo ==============================================
echo.

:: Check Node.js
node -v >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Download: https://nodejs.org
    echo.
    pause
    exit /b 1
)
node -v
echo.

:: Check path
if not exist "%SERVER_JS%" (
    echo [ERROR] %SERVER_JS% not found.
    echo Run this file from the project root folder.
    echo.
    pause
    exit /b 1
)

echo Project: %CD%
echo.

:: Install dependencies if needed
if not exist "%SENDER_DIR%\node_modules" (
    echo [INFO] Installing dependencies... (first run)
    echo.
    cd /d "%SENDER_DIR%"
    call npm install
    cd /d "%CD%"
    echo.
)

:: Session status
if exist "%SENDER_DIR%\.wwebjs_auth" (
    echo [INFO] WhatsApp session saved.
) else (
    echo [INFO] QR code will appear in browser.
)
echo.

:: Open browser and start server
echo [INFO] Opening browser...
start http://localhost:%PORT%

echo [INFO] Starting local server...
echo.
echo ==============================================
echo.

cd /d "%SENDER_DIR%"
node server.js
cd /d "%CD%"

echo.
echo ==============================================
echo [INFO] Server stopped.
echo.
pause
