import express from 'express';
import cors from 'cors';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode';

const { Client, LocalAuth } = pkg;

const app = express();
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://abdarhemsheet-max.github.io').split(',');

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '5mb' }));

let client = null;
let clientReady = false;
let qrCodeData = null;
let qrGenerated = false;
let senderNumber = '';
let lastError = '';

function initClient() {
  if (client) {
    try { client.destroy(); } catch { /* ignore */ }
  }

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--single-process'
      ]
    }
  });

  client.on('qr', async (qr) => {
    qrGenerated = true;
    clientReady = false;
    lastError = '';
    try {
      qrCodeData = await qrcode.toDataURL(qr, { width: 300, margin: 2 });
      console.log('[QR] تم توليد رمز QR جديد');
    } catch {
      qrCodeData = qr;
    }
  });

  client.on('ready', () => {
    clientReady = true;
    qrGenerated = false;
    qrCodeData = null;
    lastError = '';
    try {
      senderNumber = client.info.wid.user || '';
      console.log(`[READY] WhatsApp متصل — رقم المُرسل: ${senderNumber}`);
    } catch { /* ignore */ }
  });

  client.on('disconnected', (reason) => {
    console.log(`[DISCONNECT] تم قطع الاتصال: ${reason}`);
    clientReady = false;
    qrGenerated = false;
    qrCodeData = null;
    senderNumber = '';
    lastError = `تم قطع الاتصال: ${reason}`;
    setTimeout(() => {
      console.log('[RECONNECT] جاري إعادة الاتصال...');
      initClient();
    }, 5000);
  });

  client.on('auth_failure', (msg) => {
    console.log(`[AUTH FAIL] ${msg}`);
    lastError = `فشل المصادقة: ${msg}`;
    clientReady = false;
  });

  client.initialize().catch((err) => {
    console.error('[INIT ERROR]', err.message);
    lastError = `خطأ في التهيئة: ${err.message}`;
  });
}

initClient();

app.get('/', (req, res) => {
  const status = clientReady ? '✅ متصل' : (qrCodeData ? '🔄 انتظار المسح' : '⏳ جاري التهيئة');
  const statusClass = clientReady ? 'ready' : (qrCodeData ? 'waiting' : 'init');

  res.send(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>خدمة واتساب — لوحة التحكم</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f1a; color: #e0e0e0;
      display: flex; justify-content: center; padding: 40px 20px;
    }
    .card {
      background: #1a1a2e; border-radius: 20px;
      padding: 32px; max-width: 440px; width: 100%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      text-align: center;
    }
    h1 { font-size: 1.3rem; margin-bottom: 8px; color: #fff; }
    .subtitle { color: #888; font-size: 0.85rem; margin-bottom: 24px; }
    .status-badge {
      display: inline-block; padding: 6px 16px; border-radius: 20px;
      font-size: 0.85rem; font-weight: 600; margin-bottom: 20px;
    }
    .status-badge.ready { background: #1b4332; color: #6fcf97; }
    .status-badge.waiting { background: #3d2e00; color: #f2c94c; }
    .status-badge.init { background: #1a1a3e; color: #888; }
    .qr-box {
      background: #fff; border-radius: 16px; padding: 16px;
      display: inline-block; margin: 16px 0;
    }
    .qr-box img { display: block; width: 280px; height: 280px; }
    .error-msg { color: #ff6b6b; font-size: 0.85rem; margin: 12px 0; }
    .info { margin-top: 16px; font-size: 0.85rem; color: #888; }
    .info span { color: #e0e0e0; }
    .steps { text-align: right; margin-top: 20px; font-size: 0.82rem; color: #aaa; line-height: 2; }
    .steps strong { color: #e0e0e0; }
    .refresh-btn {
      margin-top: 16px; background: #2d2d4a; border: none;
      color: #e0e0e0; padding: 8px 20px; border-radius: 10px;
      cursor: pointer; font-size: 0.85rem;
    }
    .refresh-btn:hover { background: #3d3d5a; }
    .footer { margin-top: 24px; font-size: 0.75rem; color: #555; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📱 خدمة واتساب</h1>
    <p class="subtitle">Waqf TRPOLR — WhatsApp Service</p>

    <div class="status-badge ${statusClass}">${status}</div>

    ${clientReady ? `<div style="margin: 12px 0; color: #6fcf97;">✅ WhatsApp جاهز للإرسال</div>` : ''}

    ${senderNumber ? `<div class="info">رقم المُرسل: <span>+${senderNumber}</span></div>` : ''}

    ${qrCodeData ? `
      <div class="qr-box">
        <img src="${qrCodeData}" alt="QR Code">
      </div>
      <p style="color: #f2c94c; font-size: 0.85rem;">امسح رمز QR بهاتفك</p>
      <div class="steps">
        <strong>خطوات الربط:</strong><br>
        1. افتح WhatsApp على هاتفك<br>
        2. اذهب إلى القائمة (⁝) ← الأجهزة المرتبطة<br>
        3. اضغط "ربط جهاز"<br>
        4. امسح الرمز الظاهر أعلاه
      </div>
    ` : ''}

    ${lastError ? `<div class="error-msg">⚠ ${lastError}</div>` : ''}

    ${!clientReady && !qrCodeData ? `
      <div style="margin: 20px 0; color: #888;">
        <div style="font-size: 2rem; margin-bottom: 12px;">⏳</div>
        جاري تهيئة الجلسة... قد يستغرق ذلك بضع ثوانٍ
      </div>
    ` : ''}

    <button class="refresh-btn" onclick="location.reload()">🔄 تحديث</button>

    <div class="footer">
      الخدمة تعمل على المنفذ ${PORT}
    </div>
  </div>

  <script>
    setTimeout(() => location.reload(), 5000);
  </script>
</body>
</html>`);
});

app.get('/api/whatsapp/qr', (req, res) => {
  if (clientReady) {
    return res.json({ status: 'ready', message: 'WhatsApp متصل وجاهز' });
  }
  if (qrCodeData) {
    return res.json({ status: 'qr', qr: qrCodeData });
  }
  if (qrGenerated && !qrCodeData) {
    return res.json({ status: 'generating', message: 'جارٍ توليد رمز QR...' });
  }
  return res.json({ status: 'initializing', message: 'جارٍ تهيئة الجلسة...' });
});

app.get('/api/whatsapp/status', (req, res) => {
  res.json({ ready: clientReady, connected: clientReady, sender: senderNumber });
});

app.post('/api/whatsapp/send-bulk', async (req, res) => {
  if (!clientReady) {
    return res.status(400).json({ error: 'WhatsApp غير متصل. أعد مسح QR code أولاً.' });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'يجب إرسال مصفوفة من الرسائل.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const results = [];
  const SEND_DELAY_MS = 1500;
  let aborted = false;

  req.on('close', () => {
    aborted = true;
    console.log('[ABORT] العميل قطع الاتصال');
  });

  for (let i = 0; i < messages.length; i++) {
    if (aborted) break;

    const { phone, message, student_id, name } = messages[i];
    const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;

    try {
      await client.sendMessage(chatId, message);
      results.push({ student_id, name, phone, status: 'sent', at: new Date().toISOString() });
      res.write(`data: ${JSON.stringify({ type: 'sent', index: i, total: messages.length, student_id, name, phone })}\n\n`);
      console.log(`[SENT] ${i + 1}/${messages.length} — ${name}`);
    } catch (err) {
      results.push({ student_id, name, phone, status: 'failed', error: err.message, at: new Date().toISOString() });
      res.write(`data: ${JSON.stringify({ type: 'failed', index: i, total: messages.length, student_id, name, phone, error: err.message })}\n\n`);
      console.log(`[FAILED] ${i + 1}/${messages.length} — ${name}: ${err.message}`);
    }

    if (i < messages.length - 1 && !aborted) {
      await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
    }
  }

  const sentCount = results.filter((r) => r.status === 'sent').length;
  console.log(`[DONE] تم الإرسال: ${sentCount}/${messages.length}`);
  res.write(`data: ${JSON.stringify({ type: 'done', results })}\n\n`);
  res.end();
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    ready: clientReady,
    sender: senderNumber,
    uptime: process.uptime()
  });
});

app.listen(PORT, () => {
  console.log(`\n==============================`);
  console.log(`  WhatsApp Service  🟢`);
  console.log(`  المنفذ: ${PORT}`);
  console.log(`  افتح:  http://localhost:${PORT}`);
  console.log(`==============================\n`);
});
