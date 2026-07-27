@echo off
chcp 65001 >nul
title خدمة واتساب - Waqf TRPOLR
echo ============================================
echo    خدمة واتساب — تشغيل محلي
echo    Waqf WhatsApp Service
echo ============================================
echo.

cd /d "%~dp0whatsapp-service"

echo [1/3] التحقق من الاعتماديات...
if not exist "node_modules" (
    echo جاري تثبيت الاعتماديات...
    call npm install
    if %errorlevel% neq 0 (
        echo فشل تثبيت الاعتماديات. تأكد من تثبيت Node.js
        pause
        exit /b 1
    )
) else (
    echo تم التحقق من الاعتماديات.
)

echo [2/3] بدء الخدمة...
echo.
echo بعد ظهور رسالة "WhatsApp service running on port 3001"
echo امسح QR code الذي يظهر في المتصفح.
echo.
echo افتح الرابط في المتصفح:
echo   http://localhost:3001
echo.
echo ============================================

call npm start
if %errorlevel% neq 0 (
    echo.
    echo حدث خطأ. تأكد من:
    echo   1. Node.js مثبت (https://nodejs.org)
    echo   2. لا يوجد برنامج آخر يستخدم المنفذ 3001
    pause
)

pause
