#!/bin/bash
echo "============================================"
echo "  خدمة واتساب — تشغيل محلي"
echo "  Waqf WhatsApp Service"
echo "============================================"
echo ""

cd "$(dirname "$0")/whatsapp-service"

echo "[1/3] التحقق من الاعتماديات..."
if [ ! -d "node_modules" ]; then
    echo "جارٍ تثبيت الاعتماديات..."
    npm install
    if [ $? -ne 0 ]; then
        echo "فشل تثبيت الاعتماديات. تأكد من تثبيت Node.js"
        exit 1
    fi
else
    echo "تم التحقق من الاعتماديات."
fi

echo "[2/3] بدء الخدمة..."
echo ""
echo "بعد ظهور رسالة \"WhatsApp service running on port 3001\""
echo "افتح الرابط في المتصفح:"
echo "  http://localhost:3001"
echo ""

npm start
