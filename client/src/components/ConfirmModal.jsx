import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = 'Confirm Deletion',
  message = 'Are you sure you want to proceed?',
  warningNote = 'This action cannot be undone and will permanently remove this resource.',
  confirmText = 'Yes, Delete',
  cancelText = 'Cancel',
  danger = true,
  loading = false,
  onConfirm,
  onClose
}) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const headerBg = danger ? 'var(--neo-red)' : 'var(--neo-yellow)';
  const confirmBtnClass = danger ? 'btn-neo-danger' : 'btn-neo-primary';

  return (
    <div
      className="neo-modal-overlay"
      onClick={loading ? undefined : onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="neo-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px' }}
      >
        <div
          className="neo-modal-header"
          style={{
            padding: '16px 22px',
            background: headerBg,
            color: '#000000',
            borderBottom: 'var(--neo-border-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trash2 size={20} color="#000000" strokeWidth={2.5} />
            <h3
              style={{
                fontSize: '1.15rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                color: '#000000',
                margin: 0
              }}
            >
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-neo-outline"
            style={{ padding: '4px 6px', background: 'transparent' }}
            aria-label="Close"
          >
            <X size={16} strokeWidth={3} />
          </button>
        </div>

        <div style={{ padding: '22px' }}>
          <p
            style={{
              fontWeight: 800,
              fontSize: '0.98rem',
              marginBottom: '14px',
              lineHeight: 1.5,
              color: 'var(--neo-text-primary)'
            }}
          >
            {message}
          </p>

          {warningNote && (
            <div
              style={{
                background: danger ? '#2A0808' : '#2A2008',
                border: 'var(--neo-border-3)',
                borderColor: danger ? 'var(--neo-red)' : 'var(--neo-yellow)',
                color: danger ? 'var(--neo-red)' : 'var(--neo-yellow)',
                padding: '12px 14px',
                fontWeight: 700,
                fontSize: '0.84rem',
                marginBottom: '22px',
                lineHeight: 1.4,
                display: 'flex',
                gap: '10px'
              }}
            >
              <AlertTriangle
                size={18}
                color={danger ? 'var(--neo-red)' : 'var(--neo-yellow)'}
                style={{ flexShrink: 0, marginTop: '2px' }}
              />
              <span>{warningNote}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="btn-neo-outline"
            >
              {cancelText}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className={confirmBtnClass}
            >
              {loading ? 'Processing...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
