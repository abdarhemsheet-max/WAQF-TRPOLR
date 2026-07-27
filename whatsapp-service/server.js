import express from 'express';
import cors from 'cors';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';

const app = express();
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://abdarhemsheet-max.github.io').split(',');

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '5mb' }));

let client = null;
let clientReady = false;
let qrCodeData = null;
let qrGenerated = false;

function initClient() {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
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
    try {
      qrCodeData = await qrcode.toDataURL(qr, { width: 300, margin: 2 });
    } catch {
      qrCodeData = qr;
    }
  });

  client.on('ready', () => {
    clientReady = true;
    qrGenerated = false;
    qrCodeData = null;
  });

  client.on('disconnected', (reason) => {
    clientReady = false;
    qrGenerated = false;
    qrCodeData = null;
    setTimeout(() => {
      try { client.initialize(); } catch { /* ignore */ }
    }, 5000);
  });

  client.initialize();
}

initClient();

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
  res.json({ ready: clientReady, connected: clientReady });
});

app.post('/api/whatsapp/send-bulk', async (req, res) => {
  if (!clientReady) {
    return res.status(400).json({ error: 'WhatsApp غير متصل. أعد مسح QR code أولاً.' });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'يجب إرسال مصفوفة من الرسائل.' });
  }

  const results = [];
  const SEND_DELAY_MS = 1500;

  for (let i = 0; i < messages.length; i++) {
    const { phone, message, student_id, name } = messages[i];
    const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;

    try {
      await client.sendMessage(chatId, message);
      results.push({ student_id, name, phone, status: 'sent', at: new Date().toISOString() });
    } catch (err) {
      results.push({
        student_id, name, phone, status: 'failed',
        error: err.message || 'فشل الإرسال',
        at: new Date().toISOString()
      });
    }

    if (i < messages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
    }
  }

  res.json({ results });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ready: clientReady, clients: client ? 1 : 0 });
});

app.listen(PORT, () => {
  console.log(`WhatsApp service running on port ${PORT}`);
});
