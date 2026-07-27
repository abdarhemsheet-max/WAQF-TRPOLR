import express from 'express';
import cors from 'cors';
import fs from 'fs';
import multer from 'multer';
import { createRequire } from 'module';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode';

const require = createRequire(import.meta.url);

const { Client, LocalAuth } = pkg;
const app = express();
const PORT = process.env.PORT || 3001;
const MESSAGES_FILE = process.cwd() + '/messages.json';

const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '5mb' }));

let client = null;
let clientReady = false;
let qrCodeData = null;
let qrGenerated = false;
let senderNumber = '';
let lastError = '';
let sendingInProgress = false;
let sendAborted = false;
let initRetries = 0;
const MAX_INIT_RETRIES = 3;

let messages = [];

function loadMessages() {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      const raw = fs.readFileSync(MESSAGES_FILE, 'utf-8');
      messages = JSON.parse(raw);
    }
  } catch { messages = []; }
}

function saveMessages() {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf-8');
  } catch (e) { console.error('[SAVE] فشل حفظ الرسائل:', e.message); }
}

loadMessages();

function getSessionPath() {
  return process.cwd() + '/.wwebjs_auth';
}

function cleanSession() {
  const p = getSessionPath();
  try {
    if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); }
    console.log('[SESSION] تم حذف مجلد الجلسة التالف');
  } catch (e) { console.error('[SESSION] فشل حذف الجلسة:', e.message); }
}

function getPuppeteerConfig() {
  const config = {
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
      '--disable-gpu', '--single-process', '--disable-site-isolation-trials',
      '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled'
    ]
  };

  const bundledPath = (() => {
    try { const p = require('puppeteer'); return p.executablePath(); } catch { return null; }
  })();

  if (bundledPath && fs.existsSync(bundledPath)) {
    console.log(`[CHROME] استخدام النسخة المضمنة: ${bundledPath}`);
    return config;
  }

  const systemPaths = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/snap/bin/chromium'
  ];

  for (const p of systemPaths) {
    if (p && fs.existsSync(p)) { config.executablePath = p; console.log(`[CHROME] تم العثور على: ${p}`); break; }
  }

  return config;
}

const puppeteerConfig = getPuppeteerConfig();

function initClient() {
  if (client) { try { client.destroy(); } catch { /* ignore */ } }

  client = new Client({
    authStrategy: new LocalAuth({ clientId: 'waqf-session' }),
    puppeteer: puppeteerConfig
  });

  client.on('qr', async (qr) => {
    qrGenerated = true; clientReady = false; lastError = '';
    try { qrCodeData = await qrcode.toDataURL(qr, { width: 300, margin: 2 }); console.log('[QR] تم توليد QR'); }
    catch { qrCodeData = qr; }
  });

  client.on('ready', () => {
    clientReady = true; qrGenerated = false; qrCodeData = null; lastError = ''; initRetries = 0;
    try { senderNumber = client.info.wid.user || ''; console.log(`[READY] متصل — رقم المُرسل: ${senderNumber}`); } catch { /* ignore */ }
  });

  client.on('disconnected', (reason) => {
    console.log(`[DISCONNECT] ${reason}`);
    clientReady = false; qrGenerated = false; qrCodeData = null; senderNumber = ''; lastError = `قطع الاتصال: ${reason}`;
    if (String(reason).includes('detach') || reason === 'NAVIGATION') { console.log('[FIX] detached frame'); cleanSession(); }
    setTimeout(() => { console.log('[RECONNECT] ...'); initClient(); }, 5000);
  });

  client.on('auth_failure', (msg) => { console.log(`[AUTH FAIL] ${msg}`); lastError = `فشل المصادقة: ${msg}`; clientReady = false; cleanSession(); });

  client.initialize().catch((err) => {
    const msg = err.message || String(err);
    console.error('[INIT ERROR]', msg);
    lastError = `خطأ في التهيئة: ${msg}`; clientReady = false;
    if (msg.includes('detach') || msg.includes('frame') || msg.includes('Session') || msg.includes('launch')) {
      initRetries++;
      if (initRetries <= MAX_INIT_RETRIES) {
        console.log(`[RETRY] ${initRetries}/${MAX_INIT_RETRIES}`);
        cleanSession();
        setTimeout(() => initClient(), 2000 * initRetries);
      } else {
        lastError = `فشلت ${MAX_INIT_RETRIES} محاولات. احذف .wwebjs_auth يدوياً.`;
        console.error('[FATAL]', lastError); initRetries = 0;
      }
    }
  });
}

initClient();

function renderUI(statusText, statusClass, extra) {
  const { pendingCount = 0, items = [], progress, uploadMsg = '' } = extra || {};
  const sent = items.filter(i => i.status === 'sent').length;
  const failed = items.filter(i => i.status === 'failed').length;

  const progHtml = progress ? `
    <div class="progress-section">
      <div class="prog-head"><span>${progress.text}</span><strong>${progress.percent}%</strong></div>
      <div class="bar-bg"><div class="bar-fill" style="width:${progress.percent}%"></div></div>
    </div>` : '';

  const rows = items.map((item, i) => `
    <tr>
      <td>${item.name || '—'}</td>
      <td dir="ltr">${item.phone}</td>
      <td class="msg-cell" title="${item.message.replace(/"/g, '&quot;')}">${item.message.length > 60 ? item.message.slice(0, 60) + '…' : item.message}</td>
      <td><span class="s-${item.status}">${item.status === 'pending' ? '🕒 قيد الانتظار' : item.status === 'sending' ? '📤 جاري' : item.status === 'sent' ? '✅ أُرسلت' : '❌ فشل'}</span></td>
    </tr>`).join('');

  const uploadForm = !clientReady ? '' : `
    <div class="upload-section">
      <form id="csvForm" enctype="multipart/form-data" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <label class="btn btn-secondary" style="cursor:pointer">
          📂 اختيار ملف CSV
          <input type="file" name="csv" accept=".csv" style="display:none" onchange="document.getElementById('csvForm').submit()">
        </label>
        <span style="color:#888;font-size:0.82rem">CSV: اسم الطالب, رقم الهاتف, نص الرسالة</span>
      </form>
      ${uploadMsg ? `<div class="upload-msg">${uploadMsg}</div>` : ''}
    </div>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>خادم واتساب المحلي</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f1a;color:#e0e0e0;padding:24px}
    .c{max-width:1100px;margin:0 auto}
    h1{font-size:1.3rem;margin-bottom:4px}
    .sub{color:#888;font-size:0.85rem;margin-bottom:20px}
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px}
    .card{background:#1a1a2e;border-radius:14px;padding:16px;text-align:center}
    .card .n{font-size:1.6rem;font-weight:700;color:#6fcf97}
    .card .l{font-size:0.8rem;color:#888;margin-top:4px}
    .badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:0.85rem;font-weight:600}
    .badge.ready{background:#1b4332;color:#6fcf97}
    .badge.wait{background:#3d2e00;color:#f2c94c}
    .badge.init{background:#1a1a3e;color:#888}
    .actions{display:flex;gap:10px;margin:16px 0;flex-wrap:wrap}
    .btn{border:none;padding:10px 20px;border-radius:10px;cursor:pointer;font-size:0.9rem;font-weight:600}
    .btn-p{background:#2d7d46;color:#fff}
    .btn-p:hover{background:#3a9e5a}
    .btn-p:disabled{background:#2d2d4a;color:#666;cursor:not-allowed}
    .btn-d{background:#8b2d2d;color:#fff}
    .btn-d:hover{background:#b33d3d}
    .btn-s{background:#2d2d4a;color:#e0e0e0}
    .btn-s:hover{background:#3d3d5a}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:0.85rem}
    th{text-align:right;padding:10px 8px;color:#888;border-bottom:1px solid #2a2a3e;font-size:0.8rem}
    td{padding:10px 8px;border-bottom:1px solid #1a1a2e}
    .msg-cell{max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:help}
    .s-pending{color:#f2c94c}.s-sending{color:#6fcf97}.s-sent{color:#27ae60}.s-failed{color:#eb5757}
    .progress-section{background:#1a1a2e;border-radius:14px;padding:16px;margin-bottom:16px}
    .prog-head{display:flex;justify-content:space-between;font-size:0.85rem;color:#888;margin-bottom:8px}
    .prog-head strong{color:#e0e0e0}
    .bar-bg{height:10px;background:rgba(255,255,255,0.1);border-radius:12px;overflow:hidden}
    .bar-fill{height:100%;border-radius:12px;background:#2d7d46;transition:width .3s}
    .qr-box{background:#fff;border-radius:16px;padding:16px;display:inline-block;margin:12px 0}
    .qr-box img{display:block;width:240px;height:240px}
    .info{margin-top:8px;color:#888;font-size:0.82rem}
    .info span{color:#e0e0e0}
    .err{color:#eb5757;font-size:0.85rem;margin:8px 0}
    .empty{text-align:center;padding:40px;color:#666}
    .upload-section{background:#1a1a2e;border-radius:14px;padding:16px;margin-bottom:16px}
    .upload-msg{margin-top:8px;color:#6fcf97;font-size:0.85rem}
  </style>
</head>
<body>
  <div class="c">
    <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px">
      <div><h1>📱 خادم واتساب المحلي</h1><p class="sub">Waqf TRPOLR — استورد CSV وأرسل</p></div>
      <div class="badge ${statusClass}">${statusText}</div>
    </div>
    ${senderNumber ? `<div class="info">رقم المُرسل: <span>+${senderNumber}</span></div>` : ''}
    ${lastError ? `<div class="err">⚠ ${lastError}</div>` : ''}
    <div class="cards">
      <div class="card"><div class="n">${pendingCount}</div><div class="l">قيد الانتظار</div></div>
      <div class="card"><div class="n" style="color:#27ae60">${sent}</div><div class="l">أُرسلت</div></div>
      <div class="card"><div class="n" style="color:#eb5757">${failed}</div><div class="l">فشل</div></div>
    </div>
    ${!clientReady && qrCodeData ? `
      <div style="text-align:center;margin:16px 0">
        <div class="qr-box"><img src="${qrCodeData}" alt="QR"></div>
        <p style="color:#f2c94c;font-size:0.85rem;">امسح QR بهاتفك</p>
        <div style="font-size:0.8rem;color:#888;margin-top:8px">1. WhatsApp ← القائمة ← الأجهزة المرتبطة<br>2. "ربط جهاز" وامسح</div>
      </div>` : ''}
    ${!clientReady && !qrCodeData ? `<div style="text-align:center;padding:24px;color:#888"><div style="font-size:2rem;margin-bottom:8px">⏳</div>جاري تهيئة جلسة WhatsApp...</div>` : ''}
    ${progHtml}
    ${clientReady ? `
      ${uploadForm}
      <div class="actions">
        <button class="btn btn-p" onclick="sendAll()" ${sendingInProgress || pendingCount === 0 ? 'disabled' : ''}>${sendingInProgress ? '📤 جاري...' : '🚀 إرسال الكل'}</button>
        ${sendingInProgress ? `<button class="btn btn-d" onclick="abortSend()">⏹ إيقاف</button>` : ''}
        <button class="btn btn-s" onclick="refresh()">🔄 تحديث</button>
        <button class="btn btn-s" onclick="clearAll()">🗑 تفريغ الكل</button>
        <button class="btn btn-s" onclick="resetSession()">🔄 إعادة الجلسة</button>
      </div>
      ${items.length === 0 ? `<div class="empty">لا توجد رسائل. ارفع ملف CSV أعلاه.</div>`
        : `<div style="overflow-x:auto"><table><thead><tr><th>الطالب</th><th>رقم الهاتف</th><th>الرسالة</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table></div>`}
    ` : ''}
    <div style="margin-top:24px;font-size:0.75rem;color:#555;text-align:center">
      localhost:${PORT} | ${new Date().toLocaleString('ar-EG')}
      ${!clientReady ? ' | <a href="/" style="color:#2d7d46">تحديث</a>' : ''}
    </div>
  </div>
  <script>
    document.getElementById('csvForm')?.addEventListener('submit', async function(e) {
      e.preventDefault();
      const fd = new FormData(this);
      const res = await fetch('/api/upload-csv', { method: 'POST', body: fd });
      const d = await res.json();
      refresh();
    });
    async function sendAll() {
      if (!confirm('تأكيد إرسال ${pendingCount} رسالة؟')) return;
      const res = await fetch('/api/send-queue', { method: 'POST' });
      const d = await res.json();
      alert('تم: ' + d.sent + ' نجاح، ' + d.failed + ' فشل' + (d.aborted ? ' (ملغي)' : ''));
      refresh();
    }
    async function abortSend() { await fetch('/api/abort-send', { method: 'POST' }); refresh(); }
    async function clearAll() { if (!confirm('تفريغ جميع الرسائل؟')) return; await fetch('/api/clear', { method: 'POST' }); refresh(); }
    async function resetSession() { if (!confirm('إعادة تعيين جلسة WhatsApp؟')) return; await fetch('/api/reset-session', { method: 'POST' }); refresh(); }
    function refresh() { location.reload(); }
    ${!sendingInProgress ? 'setTimeout(() => location.reload(), 10000);' : 'setTimeout(() => location.reload(), 2000);'}
  </script>
</body>
</html>`;
}

app.get('/', (req, res) => {
  const pendingCount = messages.filter(m => m.status === 'pending').length;
  const st = clientReady ? '✅ متصل' : (qrCodeData ? '🔄 انتظار المسح' : '⏳ جاري التهيئة');
  const sc = clientReady ? 'ready' : (qrCodeData ? 'wait' : 'init');
  res.send(renderUI(st, sc, { pendingCount, items: messages, progress: null }));
});

app.post('/api/upload-csv', upload.single('csv'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });
    const raw = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = raw.split('\n').filter(l => l.trim());
    if (lines.length < 2) return res.status(400).json({ error: 'الملف فارغ أو لا يحتوي على بيانات' });

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIdx = header.findIndex(h => h.includes('اسم'));
    const phoneIdx = header.findIndex(h => h.includes('هاتف') || h.includes('رقم') || h.includes('phone'));
    const msgIdx = header.findIndex(h => h.includes('رسالة') || h.includes('message'));

    if (nameIdx === -1 || phoneIdx === -1 || msgIdx === -1)
      return res.status(400).json({ error: 'تنسيق CSV غير صحيح. يجب: اسم الطالب, رقم الهاتف, الرسالة' });

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const name = (cols[nameIdx] || '').trim();
      let phone = (cols[phoneIdx] || '').trim().replace(/[^0-9]/g, '');
      const message = cols.slice(msgIdx).join(',').trim();
      if (!phone || !message) continue;
      if (phone.startsWith('00')) phone = phone.slice(2);
      if (phone.startsWith('0')) phone = '218' + phone.slice(1);
      messages.push({ id: crypto.randomUUID(), name, phone, message, status: 'pending', error: '' });
      imported++;
    }
    saveMessages();
    console.log(`[CSV] استورد ${imported} رسالة`);
    res.json({ ok: true, imported });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/send-queue', async (req, res) => {
  if (!clientReady) return res.status(400).json({ error: 'WhatsApp غير متصل' });
  if (sendingInProgress) return res.status(400).json({ error: 'جاري الإرسال حالياً' });

  sendAborted = false;
  sendingInProgress = true;

  const pending = messages.filter(m => m.status === 'pending');
  if (pending.length === 0) { sendingInProgress = false; return res.json({ sent: 0, failed: 0 }); }

  pending.forEach(m => m.status = 'sending');
  saveMessages();

  let sent = 0, failed = 0;

  for (let i = 0; i < pending.length; i++) {
    if (sendAborted) break;
    const m = pending[i];
    const chatId = m.phone.includes('@c.us') ? m.phone : `${m.phone}@c.us`;
    try {
      await client.sendMessage(chatId, m.message);
      m.status = 'sent'; sent++;
      console.log(`[SENT] ${i + 1}/${pending.length}`);
    } catch (err) {
      m.status = 'failed'; m.error = err.message; failed++;
      console.log(`[FAILED] ${i + 1}/${pending.length}: ${err.message}`);
    }
    saveMessages();
    if (i < pending.length - 1 && !sendAborted) await new Promise(r => setTimeout(r, 1500));
  }

  sendingInProgress = false;
  console.log(`[DONE] ${sent} نجاح, ${failed} فشل`);
  res.json({ sent, failed, aborted: sendAborted });
});

app.post('/api/clear', (req, res) => {
  messages = [];
  saveMessages();
  res.json({ ok: true });
});

app.post('/api/abort-send', (req, res) => { sendAborted = true; res.json({ ok: true }); });

app.post('/api/reset-session', (req, res) => {
  clientReady = false; qrCodeData = null; qrGenerated = false; senderNumber = ''; lastError = '';
  setTimeout(() => initClient(), 500);
  res.json({ ok: true });
});

app.get('/api/whatsapp/qr', (req, res) => {
  if (clientReady) return res.json({ status: 'ready' });
  if (qrCodeData) return res.json({ status: 'qr', qr: qrCodeData });
  if (qrGenerated && !qrCodeData) return res.json({ status: 'generating' });
  return res.json({ status: 'initializing' });
});

app.get('/api/whatsapp/status', (req, res) => {
  res.json({ ready: clientReady, connected: clientReady, sender: senderNumber });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ready: clientReady, sender: senderNumber, uptime: process.uptime(), queue: messages.length });
});

app.listen(PORT, () => {
  console.log(`\n==============================`);
  console.log(`  WhatsApp Local Server  🟢`);
  console.log(`  المنفذ: ${PORT}`);
  console.log(`  افتح:  http://localhost:${PORT}`);
  console.log(`==============================\n`);
});
