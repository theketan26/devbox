import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { MessageSquare, Send, Check, AlertCircle, RefreshCw, X, ShieldCheck } from 'lucide-react';

export default function WhatsAppSettingsModal({ onClose }) {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testMessage, setTestMessage] = useState('🔔 [Dev Box Alert Probe]\nVerification message from Dev Box control plane.');
  const [recipient, setRecipient] = useState('');
  const [sending, setSending] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await api.whatsapp.getStatus();
      setStatusData(res);
      if (res.targetRecipient) {
        setRecipient(res.targetRecipient);
      }
    } catch (err) {
      console.error('Failed to get WhatsApp status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSendTest = async (e) => {
    e.preventDefault();
    setSending(true);
    setDispatchResult(null);
    try {
      const res = await api.whatsapp.sendTest(testMessage, recipient);
      setDispatchResult(res);
    } catch (err) {
      setDispatchResult({ success: false, error: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="neo-modal-overlay" onClick={onClose}>
      <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        <div className="neo-modal-header neo-modal-header-green" style={{ padding: '18px 24px', background: 'var(--neo-green)', borderBottom: 'var(--neo-border-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#000000' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '6px', background: 'var(--neo-yellow)', border: '2px solid #000', display: 'flex' }}>
              <MessageSquare size={20} color="#000" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', margin: 0 }}>
                WhatsApp Microservice Bridge
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="btn-neo-outline" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Connection status tile */}
          <div className="neo-card-static" style={{ marginBottom: '20px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--neo-black)' }}>
                Microservice Status:
              </div>
              <span className={`neo-badge ${statusData?.online ? 'neo-badge-green' : 'neo-badge-red'}`}>
                {statusData?.online ? statusData.state : 'OFFLINE'}
              </span>
            </div>

            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--neo-black)', opacity: 0.9, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>Server URL: <code className="font-mono" style={{ background: 'var(--neo-canvas)', border: '2px solid rgba(255,255,255,0.2)', padding: '2px 6px' }}>{statusData?.configuredUrl || 'http://localhost:3000'}</code></div>
              <div>Protection: <code className="font-mono" style={{ background: 'var(--neo-canvas)', border: '2px solid rgba(255,255,255,0.2)', padding: '2px 6px' }}>x-api-key: WHATSAPP_SERVER_SECRET</code></div>
              <div>Session Engine: <code className="font-mono" style={{ background: 'var(--neo-canvas)', border: '2px solid rgba(255,255,255,0.2)', padding: '2px 6px' }}>LocalAuth (Persistent Volume)</code></div>
            </div>
          </div>

          {dispatchResult && (
            <div style={{
              background: dispatchResult.success ? 'var(--neo-green)' : 'var(--neo-red)',
              border: 'var(--neo-border-4)',
              boxShadow: 'var(--neo-shadow-sm)',
              padding: '12px 16px',
              marginBottom: '20px',
              fontSize: '0.86rem',
              fontWeight: 900,
              color: '#000000'
            }}>
              {dispatchResult.success ? (
                <div>✅ ALERT DISPATCHED SUCCESSFULLY! MESSAGE ID: {dispatchResult.messageId}</div>
              ) : (
                <div>⚠️ {dispatchResult.error || dispatchResult.note || 'DISPATCH FAILED'}</div>
              )}
            </div>
          )}

          {/* Test Dispatch Form */}
          <form onSubmit={handleSendTest}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                Recipient JID (e.g. 91XXXXXXXXXX@c.us)
              </label>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="919876543210@c.us"
                className="neo-input font-mono"
              />
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                Alert Message Test Payload
              </label>
              <textarea
                rows={3}
                required
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="neo-input"
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={onClose} className="btn-neo-outline">
                Close
              </button>
              <button
                type="submit"
                disabled={sending}
                className="btn-neo-green"
              >
                {sending ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Send WhatsApp Alert</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
