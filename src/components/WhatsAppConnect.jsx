import { useEffect, useRef, useState } from 'react';
import { fetchQR } from '../lib/whatsappService.js';
import Modal from './Modal.jsx';

export default function WhatsAppConnect({ onClose, onConnected }) {
  const [status, setStatus] = useState('initializing');
  const [qr, setQr] = useState(null);
  const [message, setMessage] = useState('');
  const intervalRef = useRef(null);

  const poll = async (retrying) => {
    try {
      const data = await fetchQR();
      setStatus(data.status);
      if (data.status === 'ready') {
        setMessage('WhatsApp متصل وجاهز للإرسال');
        clearInterval(intervalRef.current);
        setTimeout(() => onConnected?.(), 800);
        return;
      }
      if (data.status === 'qr') {
        setQr(data.qr);
        setMessage('امسح رمز QR بهاتفك');
      }
      if (data.status === 'generating') setMessage('جارٍ توليد رمز QR...');
      if (data.status === 'initializing') setMessage('جارٍ الاتصال بخادم WhatsApp...');
    } catch {
      setStatus('error');
      setMessage('تعذّر الاتصال بالخادم. تأكد من تشغيل الخدمة.');
    }
  };

  const startPolling = (retrying) => {
    setStatus('initializing');
    setMessage('جارٍ الاتصال...');
    clearInterval(intervalRef.current);
    poll(retrying);
    intervalRef.current = setInterval(poll, 3000);
  };

  useEffect(() => {
    startPolling();
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <Modal title="الاتصال بـ WhatsApp" onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        {status === 'qr' && qr && (
          <img
            src={qr}
            alt="QR Code"
            style={{
              width: 280, height: 280, borderRadius: 16,
              background: '#fff', padding: 12, marginBottom: 16
            }}
          />
        )}
        {status === 'ready' && (
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
        )}
        {status === 'error' && (
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>❌</div>
        )}
        {status === 'initializing' && (
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⏳</div>
        )}

        <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>{message}</p>

        {status === 'qr' && (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            افتح WhatsApp &gt; القائمة &gt; الأجهزة المرتبطة &gt; ربط جهاز
          </p>
        )}

        {status === 'ready' && (
          <button className="btn-primary" onClick={onClose}>تم، إغلاق</button>
        )}

        {status === 'error' && (
          <button className="btn-primary" onClick={() => startPolling(true)}>
            إعادة المحاولة
          </button>
        )}
      </div>
    </Modal>
  );
}
