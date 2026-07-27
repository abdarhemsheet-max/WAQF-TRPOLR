const SERVICE_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL || 'http://localhost:3001';

export async function fetchQR() {
  const res = await fetch(`${SERVICE_URL}/api/whatsapp/qr`);
  return res.json();
}

export async function getStatus() {
  const res = await fetch(`${SERVICE_URL}/api/whatsapp/status`);
  return res.json();
}

export { SERVICE_URL };
