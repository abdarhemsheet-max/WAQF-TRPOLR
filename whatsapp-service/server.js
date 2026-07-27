import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode';

const { Client, LocalAuth } = pkg;

const app = express();
const PORT = process.env.PORT || 3001;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mgdgxiwwcthgoylyumzg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZGd4aXd3Y3RoZ295bHl1bXpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMzExMjksImV4cCI6MjEwMDcwNzEyOX0.CkUpwhZgomsnvMrRzlnACtc-0HeAYDRwRq9xznYj8TU';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

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

function getPuppeteerConfig() {
  const config = {
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
  };

  const possiblePaths = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium'
  ];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      config.executablePath = p;
      console.log(`[CHROME] تم العثور على Chrome في: ${p}`);
      break;
    }
  }

  return config;
}

const puppeteerConfig = getPuppeteerConfig();

function initClient() {
  if (client) {
    try { client.destroy(); } catch { /* ignore */ }
  }

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerConfig
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

function renderLocalUI(statusText, statusClass, extra) {
  const { pendingCount = 0, queueItems = [], progress } = extra || {};
  const progressHtml = progress ? `
    <div class="progress-section">
      <div class="mass-progress-head">
        <span>${progress.text}</span>
        <strong>${progress.percent}%</strong>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width:${progress.percent}%"></div>
      </div>
    </div>
  ` : '';

  const rowsHtml = queueItems.map((item, i) => `
    <tr>
      <td>${item.student_name || '—'}</td>
      <td dir="ltr" style="direction:ltr">${item.phone}</td>
      <td class="msg-cell" title="${item.message.replace(/"/g, '&quot;')}">${item.message.length > 60 ? item.message.slice(0, 60) + '…' : item.message}</td>
      <td><span class="status-${item.status}">${item.status === 'pending' ? '🕒 قيد الانتظار' : item.status === 'sending' ? '📤 جاري' : item.status === 'sent' ? '✅ أُرسلت' : '❌ فشل'}</span></td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>خادم واتساب المحلي — Waqf TRPOLR</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f1a; color: #e0e0e0; padding: 24px; }
    .container { max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 1.3rem; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 0.85rem; margin-bottom: 20px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .card { background: #1a1a2e; border-radius: 14px; padding: 16px; text-align: center; }
    .card .num { font-size: 1.6rem; font-weight: 700; color: #6fcf97; }
    .card .lbl { font-size: 0.8rem; color: #888; margin-top: 4px; }
    .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; }
    .status-badge.ready { background: #1b4332; color: #6fcf97; }
    .status-badge.waiting { background: #3d2e00; color: #f2c94c; }
    .status-badge.init { background: #1a1a3e; color: #888; }
    .actions { display: flex; gap: 10px; margin: 16px 0; flex-wrap: wrap; }
    .btn { border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-size: 0.9rem; font-weight: 600; }
    .btn-primary { background: #2d7d46; color: #fff; }
    .btn-primary:hover { background: #3a9e5a; }
    .btn-primary:disabled { background: #2d2d4a; color: #666; cursor: not-allowed; }
    .btn-danger { background: #8b2d2d; color: #fff; }
    .btn-danger:hover { background: #b33d3d; }
    .btn-secondary { background: #2d2d4a; color: #e0e0e0; }
    .btn-secondary:hover { background: #3d3d5a; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { text-align: right; padding: 10px 8px; font-size: 0.8rem; color: #888; border-bottom: 1px solid #2a2a3e; }
    td { padding: 10px 8px; font-size: 0.85rem; border-bottom: 1px solid #1a1a2e; }
    .msg-cell { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: help; }
    .status-pending { color: #f2c94c; }
    .status-sending { color: #6fcf97; }
    .status-sent { color: #27ae60; }
    .status-failed { color: #eb5757; }
    .progress-section { background: #1a1a2e; border-radius: 14px; padding: 16px; margin-bottom: 16px; }
    .mass-progress-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.85rem; color: #888; margin-bottom: 8px; }
    .mass-progress-head strong { color: #e0e0e0; }
    .progress-bar-bg { height: 10px; background: rgba(255,255,255,0.1); border-radius: 12px; overflow: hidden; }
    .progress-bar-fill { height: 100%; border-radius: 12px; background: #2d7d46; transition: width 0.3s ease; }
    .qr-box { background: #fff; border-radius: 16px; padding: 16px; display: inline-block; margin: 12px 0; }
    .qr-box img { display: block; width: 240px; height: 240px; }
    .info { margin-top: 8px; color: #888; font-size: 0.82rem; }
    .info span { color: #e0e0e0; }
    .error-msg { color: #eb5757; font-size: 0.85rem; margin: 8px 0; }
    .empty { text-align: center; padding: 40px; color: #666; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .tab { padding: 8px 16px; border-radius: 8px; background: #1a1a2e; color: #888; cursor: pointer; border: none; font-size: 0.85rem; }
    .tab.active { background: #2d7d46; color: #fff; }
    .tab:hover { background: #2a2a3e; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px">
      <div>
        <h1>📱 خادم واتساب المحلي</h1>
        <p class="subtitle">Waqf TRPOLR — WhatsApp Local Server</p>
      </div>
      <div class="status-badge ${statusClass}">${statusText}</div>
    </div>

    ${senderNumber ? `<div class="info">رقم المُرسل: <span>+${senderNumber}</span></div>` : ''}
    ${lastError ? `<div class="error-msg">⚠ ${lastError}</div>` : ''}

    <div class="cards">
      <div class="card"><div class="num">${pendingCount}</div><div class="lbl">رسائل قيد الانتظار</div></div>
      <div class="card"><div class="num" style="color:#27ae60">${queueItems.filter(i => i.status === 'sent').length}</div><div class="lbl">أُرسلت</div></div>
      <div class="card"><div class="num" style="color:#eb5757">${queueItems.filter(i => i.status === 'failed').length}</div><div class="lbl">فشل</div></div>
    </div>

    ${!clientReady && qrCodeData ? `
      <div style="text-align:center;margin:16px 0">
        <div class="qr-box"><img src="${qrCodeData}" alt="QR"></div>
        <p style="color:#f2c94c;font-size:0.85rem;">امسح رمز QR بهاتفك</p>
        <div style="font-size:0.8rem;color:#888;margin-top:8px">
          1. افتح WhatsApp ← القائمة ← الأجهزة المرتبطة<br>
          2. اضغط "ربط جهاز" وامسح الرمز
        </div>
      </div>
    ` : ''}

    ${!clientReady && !qrCodeData ? `
      <div style="text-align:center;padding:24px;color:#888">
        <div style="font-size:2rem;margin-bottom:8px">⏳</div>
        جاري تهيئة جلسة WhatsApp...
      </div>
    ` : ''}

    ${progressHtml}

    ${clientReady ? `
      <div class="tabs">
        <button class="tab active">طابور الإرسال</button>
      </div>

      <div class="actions">
        <button class="btn btn-primary" onclick="sendAll()" ${sendingInProgress || pendingCount === 0 ? 'disabled' : ''}>
          ${sendingInProgress ? '📤 جاري الإرسال...' : '🚀 إرسال الكل'}
        </button>
        ${sendingInProgress ? `<button class="btn btn-danger" onclick="abortSend()">⏹ إيقاف</button>` : ''}
        <button class="btn btn-secondary" onclick="refresh()">🔄 تحديث</button>
        <button class="btn btn-secondary" onclick="resetSession()">🔄 إعادة تعيين الجلسة</button>
      </div>

      ${queueItems.length === 0 ? `
        <div class="empty">لا توجد رسائل في طابور الإرسال.<br>اذهب إلى لوحة المدير على GitHub Pages ← المراسلة الجماعية ← أرسل البيانات.</div>
      ` : `
        <div style="overflow-x:auto">
          <table>
            <thead><tr><th>الطالب</th><th>رقم الهاتف</th><th>الرسالة</th><th>الحالة</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `}
    ` : ''}

    <div style="margin-top:24px;font-size:0.75rem;color:#555;text-align:center">
      الخدمة تعمل على المنفذ ${PORT} | ${new Date().toLocaleString('ar-EG')}
      ${!clientReady ? ' | <a href="/" style="color:#2d7d46">تحديث الصفحة</a>' : ''}
    </div>
  </div>

  <script>
    async function sendAll() {
      if (!confirm('تأكيد إرسال ${pendingCount} رسالة عبر WhatsApp؟')) return;
      const btn = document.querySelector('.btn-primary');
      btn.disabled = true; btn.textContent = '📤 جاري الإرسال...';
      try {
        const res = await fetch('/api/send-queue', { method: 'POST' });
        const data = await res.json();
        alert('تم الإرسال: ' + data.sent + ' نجاح، ' + data.failed + ' فشل');
      } catch(e) {
        alert('خطأ: ' + e.message);
      }
      refresh();
    }
    async function abortSend() {
      await fetch('/api/abort-send', { method: 'POST' });
      refresh();
    }
    function refresh() { location.reload(); }
    async function resetSession() {
      if (!confirm('إعادة تعيين جلسة WhatsApp؟')) return;
      await fetch('/api/reset-session', { method: 'POST' });
      refresh();
    }
    ${!sendingInProgress ? `setTimeout(() => location.reload(), 10000);` : `setTimeout(() => location.reload(), 2000);`}
  </script>
</body>
</html>`;
}

app.get('/', async (req, res) => {
  const { data: queueItems, error } = await sb
    .from('messages_queue')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(200);

  const pending = (queueItems || []).filter(i => i.status === 'pending');
  const pendingCount = pending.length;
  const items = queueItems || [];

  const statusText = clientReady ? '✅ متصل' : (qrCodeData ? '🔄 انتظار المسح' : '⏳ جاري التهيئة');
  const statusClass = clientReady ? 'ready' : (qrCodeData ? 'waiting' : 'init');

  res.send(renderLocalUI(statusText, statusClass, {
    pendingCount, queueItems: items, progress: null
  }));
});

app.post('/api/send-queue', async (req, res) => {
  if (!clientReady) {
    return res.status(400).json({ error: 'WhatsApp غير متصل. امسح QR أولاً.' });
  }
  if (sendingInProgress) {
    return res.status(400).json({ error: 'جاري الإرسال حالياً.' });
  }

  sendAborted = false;
  sendingInProgress = true;

  try {
    const { data: pending } = await sb
      .from('messages_queue')
      .select('id, phone, message, student_name')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!pending || pending.length === 0) {
      sendingInProgress = false;
      return res.json({ sent: 0, failed: 0, message: 'لا توجد رسائل قيد الانتظار.' });
    }

    const ids = pending.map(p => p.id);
    await sb.from('messages_queue').update({ status: 'sending' }).in('id', ids);

    let sent = 0, failed = 0;

    for (let i = 0; i < pending.length; i++) {
      if (sendAborted) break;

      const { id, phone, message } = pending[i];
      const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;

      try {
        await client.sendMessage(chatId, message);
        await sb.from('messages_queue').update({ status: 'sent', finished_at: new Date().toISOString() }).eq('id', id);
        sent++;
        console.log(`[SENT] ${i + 1}/${pending.length}`);
      } catch (err) {
        await sb.from('messages_queue').update({ status: 'failed', error: err.message, finished_at: new Date().toISOString() }).eq('id', id);
        failed++;
        console.log(`[FAILED] ${i + 1}/${pending.length}: ${err.message}`);
      }

      if (i < pending.length - 1 && !sendAborted) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (sendAborted) {
      const remaining = pending.slice(sent + failed);
      if (remaining.length > 0) {
        const remainingIds = remaining.map(r => r.id);
        await sb.from('messages_queue').update({ status: 'pending', error: '' }).in('id', remainingIds);
      }
    }

    sendingInProgress = false;
    console.log(`[DONE] تم: ${sent} نجاح, ${failed} فشل`);
    res.json({ sent, failed, aborted: sendAborted });

    await sb.rpc('archive_completed_batch', {}).catch(() => {});
  } catch (err) {
    sendingInProgress = false;
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/abort-send', (req, res) => {
  sendAborted = true;
  res.json({ ok: true });
});

app.post('/api/reset-session', (req, res) => {
  clientReady = false;
  qrCodeData = null;
  qrGenerated = false;
  senderNumber = '';
  lastError = '';
  setTimeout(() => initClient(), 500);
  res.json({ ok: true });
});

app.get('/api/whatsapp/qr', (req, res) => {
  if (clientReady) return res.json({ status: 'ready', message: 'WhatsApp متصل وجاهز' });
  if (qrCodeData) return res.json({ status: 'qr', qr: qrCodeData });
  if (qrGenerated && !qrCodeData) return res.json({ status: 'generating', message: 'جارٍ توليد رمز QR...' });
  return res.json({ status: 'initializing', message: 'جارٍ تهيئة الجلسة...' });
});

app.get('/api/whatsapp/status', (req, res) => {
  res.json({ ready: clientReady, connected: clientReady, sender: senderNumber });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ready: clientReady, sender: senderNumber, uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`\n==============================`);
  console.log(`  WhatsApp Local Server  🟢`);
  console.log(`  المنفذ: ${PORT}`);
  console.log(`  افتح:  http://localhost:${PORT}`);
  console.log(`==============================\n`);
});
