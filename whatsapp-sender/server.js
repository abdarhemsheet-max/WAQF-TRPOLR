import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs, { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import multer from 'multer';
import { createRequire } from 'module';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode';

const require = createRequire(import.meta.url);
const { Client, LocalAuth } = pkg;

const app = express();
const PORT = process.env.PORT || 3330;
const DATA_FILE = process.cwd() + '/data.json';
const SESSION_ID = 'waqf-sender';

// ── middlewares ──────────────────────────────────────────

const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── state ────────────────────────────────────────────────

let client = null;
let clientReady = false;
let qrDataUrl = null;
let senderNumber = '';
let lastError = '';
let sending = false;
let aborted = false;
let messages = [];
let sseClients = [];

function loadData() {
  try {
    if (existsSync(DATA_FILE)) messages = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  } catch { messages = []; }
}
function saveData() {
  try { writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2), 'utf-8'); } catch {}
}

loadData();

// ── chrome / puppeteer ───────────────────────────────────

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH))
    return { executablePath: process.env.CHROME_PATH };

  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'
  ];
  for (const p of paths) if (existsSync(p)) return { executablePath: p };

  try {
    const puppeteer = require('puppeteer');
    const ep = puppeteer.executablePath();
    if (existsSync(ep)) return {};
  } catch {}

  return {};
}

function getPuppeteerConfig() {
  return {
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
      '--disable-gpu', '--single-process', '--disable-site-isolation-trials',
      '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled'
    ],
    ...findChrome()
  };
}

// ── whatsapp client ──────────────────────────────────────

function cleanSession() {
  const authPath = `${process.cwd()}/.wwebjs_auth/${SESSION_ID}`;
  try { if (existsSync(authPath)) rmSync(authPath, { recursive: true, force: true }); } catch {}
}

function initClient() {
  if (client) try { client.destroy(); } catch {}

  client = new Client({
    authStrategy: new LocalAuth({ clientId: SESSION_ID }),
    puppeteer: getPuppeteerConfig()
  });

  client.on('qr', async (qr) => {
    clientReady = false; lastError = '';
    try {
      qrDataUrl = await qrcode.toDataURL(qr, { width: 280, margin: 2, color: { dark: '#000', light: '#fff' } });
    } catch { qrDataUrl = null; }
    broadcast({ type: 'qr', qr: qrDataUrl });
  });

  client.on('ready', () => {
    clientReady = true; qrDataUrl = null; lastError = '';
    try { senderNumber = client.info.wid.user || ''; } catch {}
    broadcast({ type: 'ready', sender: senderNumber });
    console.log(`[READY] +${senderNumber}`);
  });

  client.on('disconnected', (reason) => {
    clientReady = false; qrDataUrl = null; senderNumber = ''; lastError = `قطع الاتصال: ${reason}`;
    const r = String(reason);
    if (r.includes('detach') || r === 'NAVIGATION') cleanSession();
    broadcast({ type: 'disconnected', reason });
    setTimeout(() => { console.log('[RECONNECT] ...'); initClient(); }, 5000);
  });

  client.on('auth_failure', (msg) => {
    lastError = `فشل المصادقة: ${msg}`; clientReady = false;
    cleanSession();
    broadcast({ type: 'error', error: lastError });
  });

  client.initialize().catch((err) => {
    lastError = `خطأ في التهيئة: ${err.message}`;
    broadcast({ type: 'error', error: lastError });
  });
}

// ── SSE ──────────────────────────────────────────────────

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter(res => { try { res.write(msg); return true; } catch { return false; } });
}

// ── routes ────────────────────────────────────────────────

app.get('/', (req, res) => {
  const pending = messages.filter(m => m.status === 'pending').length;
  const sent = messages.filter(m => m.status === 'sent').length;
  const failed = messages.filter(m => m.status === 'failed').length;

  const statusBadge = clientReady ? 'متصل' : (qrDataUrl ? 'انتظار المسح' : 'جاري التهيئة');
  const badgeClass = clientReady ? 'ready' : (qrDataUrl ? 'wait' : 'init');

  res.send(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>مرسل واتساب المحلي</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap');
  body{font-family:'Noto Sans Arabic',-apple-system,sans-serif;background:#0a0a14;color:#e0e0e0;min-height:100vh}
  .app{max-width:900px;margin:0 auto;padding:20px}
  header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:16px 0;border-bottom:1px solid #1e1e32;margin-bottom:20px}
  header h1{font-size:1.2rem;font-weight:700;color:#e0e0e0}
  header .sub{font-size:0.75rem;color:#666;margin-top:2px}
  .badge{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:0.8rem;font-weight:600}
  .badge.ready{background:#0d2818;color:#4ade80}
  .badge.wait{background:#2a1f00;color:#fbbf24}
  .badge.init{background:#12122a;color:#666}
  .badge.off{background:#2a0a0a;color:#f87171}
  .badge::before{content:'';width:8px;height:8px;border-radius:50%;display:inline-block}
  .badge.ready::before{background:#4ade80;box-shadow:0 0 8px #4ade8044}
  .badge.wait::before{background:#fbbf24;box-shadow:0 0 8px #fbbf2444;animation:pulse 1.5s infinite}
  .badge.init::before{background:#555;animation:pulse 1s infinite}
  .badge.off::before{background:#f87171}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .status-line{font-size:0.8rem;color:#888;margin:4px 0 12px}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
  .stat{background:#12121e;border-radius:12px;padding:14px;text-align:center}
  .stat .num{font-size:1.5rem;font-weight:700}
  .stat .lbl{font-size:0.7rem;color:#666;margin-top:4px}
  .stat:nth-child(1) .num{color:#fbbf24}
  .stat:nth-child(2) .num{color:#4ade80}
  .stat:nth-child(3) .num{color:#f87171}
  .stat:nth-child(4) .num{color:#60a5fa}
  .upload-zone{background:#12121e;border:2px dashed #2a2a44;border-radius:14px;padding:32px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:16px}
  .upload-zone:hover,.upload-zone.dragover{border-color:#4ade80;background:#0d1f12}
  .upload-zone .icon{font-size:2.2rem;margin-bottom:8px}
  .upload-zone p{font-size:0.85rem;color:#888}
  .upload-zone .hint{font-size:0.75rem;color:#555;margin-top:6px}
  .upload-zone input{display:none}
  .actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
  .btn{padding:10px 20px;border:none;border-radius:10px;font-size:0.85rem;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
  .btn:disabled{opacity:.4;cursor:not-allowed}
  .btn-primary{background:#166534;color:#fff}
  .btn-primary:hover:not(:disabled){background:#1a7a3e}
  .btn-danger{background:#7f1d1d;color:#fff}
  .btn-danger:hover:not(:disabled){background:#991b1b}
  .btn-outline{background:transparent;color:#888;border:1px solid #2a2a44}
  .btn-outline:hover{background:#1a1a2e;color:#e0e0e0}
  .btn-sm{padding:6px 12px;font-size:0.78rem}
  .table-wrap{overflow-x:auto;border-radius:12px;border:1px solid #1a1a2e;margin-top:8px}
  table{width:100%;border-collapse:collapse;font-size:0.82rem}
  th{text-align:right;padding:10px 10px;color:#666;border-bottom:1px solid #1a1a2e;font-weight:600;font-size:0.75rem}
  td{padding:10px 10px;border-bottom:1px solid #0e0e1a}
  .msg-cell{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:help}
  .s-pending{color:#fbbf24}.s-sending{color:#60a5fa}.s-sent{color:#4ade80}.s-failed{color:#f87171}
  .qr-box{background:#fff;border-radius:16px;padding:16px;display:inline-block;margin:12px auto}
  .qr-box img{display:block;width:240px;height:240px}
  .empty{text-align:center;padding:40px;color:#555;font-size:0.85rem}
  .toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#e0e0e0;padding:10px 20px;border-radius:10px;font-size:0.82rem;border:1px solid #2a2a44;opacity:0;transition:opacity .3s;z-index:999}
  .toast.show{opacity:1}
  .progress-bar{height:6px;background:#1e1e32;border-radius:4px;overflow:hidden;margin:8px 0}
  .progress-fill{height:100%;background:#4ade80;border-radius:4px;transition:width .3s}
  .sender-info{font-size:0.75rem;color:#555;text-align:center;padding:20px 0}
  .sender-info a{color:#4ade80;text-decoration:none}
  @media(max-width:600px){.stats{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<div class="app">
  <header>
    <div>
      <h1>📱 مرسل واتساب المحلي</h1>
      <div class="sub">دورة حفاظ الوحيين السادسة — تحميل CSV وإرسال جماعي</div>
    </div>
    <div class="badge ${badgeClass}" id="statusBadge">${statusBadge}</div>
  </header>

  <div class="status-line" id="statusLine">${senderNumber ? `رقم المُرسل: <strong>+${senderNumber}</strong>` : lastError ? `<span style="color:#f87171">⚠ ${lastError}</span>` : ''}</div>

  <div class="stats">
    <div class="stat"><div class="num" id="statPending">${pending}</div><div class="lbl">قيد الانتظار</div></div>
    <div class="stat"><div class="num" id="statSent">${sent}</div><div class="lbl">أُرسلت</div></div>
    <div class="stat"><div class="num" id="statFailed">${failed}</div><div class="lbl">فشل</div></div>
    <div class="stat"><div class="num" id="statTotal">${messages.length}</div><div class="lbl">المجموع</div></div>
  </div>

  <div id="qrArea" style="display:${qrDataUrl ? 'block' : 'none'};text-align:center;margin-bottom:16px">
    <div class="qr-box"><img id="qrImg" src="${qrDataUrl || ''}" alt="QR"></div>
    <p style="color:#fbbf24;font-size:0.82rem;margin-top:8px">📱 امسح رمز QR بهاتفك</p>
    <p style="font-size:0.75rem;color:#666;margin-top:4px">WhatsApp ← القائمة ← الأجهزة المرتبطة ← ربط جهاز</p>
  </div>

  <div id="initMsg" style="display:${(!clientReady && !qrDataUrl) ? 'block' : 'none'};text-align:center;padding:20px;color:#666">
    <div style="font-size:2rem;margin-bottom:8px">⏳</div>
    <div>جاري تهيئة جلسة WhatsApp...</div>
  </div>

  ${clientReady ? `
  <div class="upload-zone" id="dropZone">
    <div class="icon">📂</div>
    <p>اسحب ملف CSV هنا أو انقر لاختياره</p>
    <div class="hint">الملف يجب أن يحتوي على عمودين: Phone Number, Message</div>
    <input type="file" id="fileInput" accept=".csv">
  </div>
  ` : ''}

  <div id="actionsBar" style="display:${(clientReady && messages.length > 0) ? 'flex' : 'none'}" class="actions">
    <button class="btn btn-primary" id="sendBtn" onclick="startSend()" ${sending ? 'disabled' : ''}>
      🚀 إرسال الكل
    </button>
    <button class="btn btn-danger" id="abortBtn" style="display:${sending ? 'inline-flex' : 'none'}" onclick="abortSend()">
      ⏹ إيقاف
    </button>
    <button class="btn btn-outline" onclick="clearMessages()">🗑 تفريغ</button>
    <button class="btn btn-outline" onclick="resetSession()">🔄 إعادة الجلسة</button>
  </div>

  <div id="progressArea" style="display:none;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:#888">
      <span id="progText">جاري الإرسال...</span>
      <strong id="progPercent" style="color:#4ade80">0%</strong>
    </div>
    <div class="progress-bar"><div class="progress-fill" id="progFill" style="width:0%"></div></div>
  </div>

  <div id="tableArea">
    ${messages.length === 0 ? '<div class="empty">📭 لا توجد رسائل. ارفع ملف CSV بعد اتصال WhatsApp.</div>' : `
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>رقم الهاتف</th><th>الرسالة</th><th>الحالة</th></tr></thead>
        <tbody>
          ${messages.map((m, i) => `
          <tr>
            <td style="color:#555">${i + 1}</td>
            <td dir="ltr">+${m.phone}</td>
            <td class="msg-cell" title="${m.message.replace(/"/g,'&quot;')}">${m.message.length > 70 ? m.message.slice(0,70)+'…' : m.message}</td>
            <td><span class="s-${m.status}">${m.status === 'pending' ? '🕒 قيد الانتظار' : m.status === 'sending' ? '📤 جاري' : m.status === 'sent' ? '✅ أُرسلت' : '❌ ' + (m.error || 'فشل')}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`}
  </div>

  <div class="sender-info">
    localhost:${PORT} | <a href="/">تحديث</a>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
const evtSource = new EventSource('/events');
evtSource.onmessage = (e) => {
  const d = JSON.parse(e.data);
  if (d.type === 'qr') {
    document.getElementById('qrArea').style.display = 'block';
    document.getElementById('qrImg').src = d.qr;
    document.getElementById('initMsg').style.display = 'none';
    updateBadge('wait', 'انتظار المسح');
  }
  if (d.type === 'ready') {
    document.getElementById('qrArea').style.display = 'none';
    document.getElementById('initMsg').style.display = 'none';
    updateBadge('ready', 'متصل');
    document.getElementById('statusLine').innerHTML = 'رقم المُرسل: <strong>+' + (d.sender || '') + '</strong>';
    location.reload();
  }
  if (d.type === 'disconnected') {
    updateBadge('off', 'غير متصل');
    document.getElementById('statusLine').innerHTML = '<span style="color:#f87171">⚠ قطع الاتصال</span>';
  }
  if (d.type === 'progress') {
    const p = d.percent || 0;
    document.getElementById('progFill').style.width = p + '%';
    document.getElementById('progPercent').textContent = p + '%';
    document.getElementById('progText').textContent = 'جاري الإرسال... ' + d.sent + '/' + d.total;
    document.getElementById('statSent').textContent = d.sent || 0;
    document.getElementById('statFailed').textContent = d.failed || 0;
  }
  if (d.type === 'done') {
    document.getElementById('progressArea').style.display = 'none';
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('sendBtn').textContent = '🚀 إرسال الكل';
    document.getElementById('abortBtn').style.display = 'none';
    showToast('✅ تم الإرسال: ' + d.sent + ' نجاح، ' + d.failed + ' فشل');
    setTimeout(() => location.reload(), 2000);
  }
  if (d.type === 'error') {
    document.getElementById('statusLine').innerHTML = '<span style="color:#f87171">⚠ ' + d.error + '</span>';
    updateBadge('off', 'خطأ');
  }
};

function updateBadge(cls, text) {
  const b = document.getElementById('statusBadge');
  b.className = 'badge ' + cls;
  b.textContent = text;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

// drag & drop
const dropZone = document.getElementById('dropZone');
if (dropZone) {
  const fileInput = document.getElementById('fileInput');
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); uploadFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) uploadFile(fileInput.files[0]); });
}

async function uploadFile(file) {
  if (!file) return;
  const fd = new FormData();
  fd.append('csv', file);
  const res = await fetch('/upload', { method: 'POST', body: fd });
  const d = await res.json();
  if (d.error) { showToast('❌ ' + d.error); return; }
  showToast('✅ تم استيراد ' + d.imported + ' رسالة');
  setTimeout(() => location.reload(), 800);
}

async function startSend() {
  document.getElementById('progressArea').style.display = 'block';
  document.getElementById('sendBtn').disabled = true;
  document.getElementById('sendBtn').textContent = '📤 جاري...';
  document.getElementById('abortBtn').style.display = 'inline-flex';
  await fetch('/send', { method: 'POST' });
}

async function abortSend() { await fetch('/abort', { method: 'POST' }); showToast('⏹ تم إيقاف الإرسال'); }
async function clearMessages() { if (!confirm('تفريغ جميع الرسائل؟')) return; await fetch('/clear', { method: 'POST' }); location.reload(); }
async function resetSession() { if (!confirm('إعادة تعيين جلسة WhatsApp؟')) return; await fetch('/reset', { method: 'POST' }); showToast('🔄 جاري إعادة الجلسة...'); setTimeout(() => location.reload(), 3000); }
</script>
</body>
</html>`);
});

// ── SSE endpoint ─────────────────────────────────────────

app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('data: {"type":"connected"}\n\n');
  sseClients.push(res);
  req.on('close', () => { sseClients = sseClients.filter(r => r !== res); });
});

// ── API ──────────────────────────────────────────────────

app.post('/upload', upload.single('csv'), (req, res) => {
  try {
    if (!req.file) return res.json({ error: 'لم يتم رفع ملف' });
    const raw = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = raw.split('\n').filter(l => l.trim());
    if (lines.length < 2) return res.json({ error: 'الملف فارغ' });

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const phoneIdx = header.findIndex(h => h.includes('phone') || h.includes('رقم') || h.includes('هاتف'));
    const msgIdx = header.findIndex(h => h.includes('message') || h.includes('رسالة'));
    if (phoneIdx === -1 || msgIdx === -1) return res.json({ error: 'تنسيق CSV غير صحيح. يجب: Phone Number, Message' });

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      let phone = (cols[phoneIdx] || '').trim().replace(/[^0-9]/g, '');
      let message = cols.slice(msgIdx).join(',').trim();
      if (message.startsWith('"') && message.endsWith('"'))
        message = message.slice(1, -1).replace(/""/g, '"');
      if (!phone || !message) continue;
      if (phone.startsWith('00')) phone = phone.slice(2);
      if (phone.startsWith('0')) phone = '218' + phone.slice(1);
      messages.push({ id: crypto.randomUUID(), phone, message, status: 'pending', error: '' });
      imported++;
    }
    saveData();
    res.json({ imported });
  } catch (e) { res.json({ error: e.message }); }
});

app.post('/send', async (req, res) => {
  if (!clientReady || sending) return res.json({ error: 'غير متاح' });
  sending = true; aborted = false;
  const pending = messages.filter(m => m.status === 'pending');
  if (!pending.length) { sending = false; return res.json({ sent: 0, failed: 0 }); }

  pending.forEach(m => m.status = 'sending');
  saveData();

  let sent = 0, failed = 0;
  for (let i = 0; i < pending.length; i++) {
    if (aborted) break;
    const m = pending[i];
    try {
      await client.sendMessage(m.phone.includes('@c.us') ? m.phone : `${m.phone}@c.us`, m.message);
      m.status = 'sent'; sent++;
    } catch (err) {
      m.status = 'failed'; m.error = err.message; failed++;
    }
    saveData();
    broadcast({ type: 'progress', sent, failed, total: pending.length, percent: Math.round(((sent + failed) / pending.length) * 100) });
    if (i < pending.length - 1 && !aborted) await new Promise(r => setTimeout(r, randomDelay()));
  }
  sending = false;
  broadcast({ type: 'done', sent, failed, aborted });
  res.json({ sent, failed, aborted });
});

function randomDelay() {
  return Math.floor(Math.random() * 4000) + 3000;
}

app.post('/abort', (req, res) => { aborted = true; res.json({ ok: true }); });
app.post('/clear', (req, res) => { messages = []; saveData(); res.json({ ok: true }); });
app.post('/reset', (req, res) => {
  clientReady = false; qrDataUrl = null; senderNumber = ''; lastError = '';
  setTimeout(() => initClient(), 500);
  res.json({ ok: true });
});

// ── start ────────────────────────────────────────────────

initClient();

app.listen(PORT, () => {
  console.log(`\n═══════════════════════════════════`);
  console.log(`  📱  مرسل واتساب المحلي`);
  console.log(`  🟢  http://localhost:${PORT}`);
  console.log(`═══════════════════════════════════\n`);
});
