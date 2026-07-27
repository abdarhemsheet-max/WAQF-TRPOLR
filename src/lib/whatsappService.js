const SERVICE_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL || 'http://localhost:3001';

export async function fetchQR() {
  const res = await fetch(`${SERVICE_URL}/api/whatsapp/qr`);
  return res.json();
}

export async function getStatus() {
  const res = await fetch(`${SERVICE_URL}/api/whatsapp/status`);
  return res.json();
}

export async function sendBulk(messages) {
  const res = await fetch(`${SERVICE_URL}/api/whatsapp/send-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });
  return res.json();
}

export async function sendBulkStream(messages, onProgress) {
  const res = await fetch(`${SERVICE_URL}/api/whatsapp/send-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'فشل الاتصال بالخادم');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        try {
          const data = JSON.parse(trimmed.slice(6));
          onProgress(data);
        } catch { /* ignore parse errors */ }
      }
    }
  }
}

export { SERVICE_URL };
