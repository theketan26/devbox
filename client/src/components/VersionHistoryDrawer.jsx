import React, { useState } from 'react';
import { api } from '../services/api.js';
import ConfirmModal from './ConfirmModal.jsx';
import { History, RotateCcw, X, Check, Shield } from 'lucide-react';

export default function VersionHistoryDrawer({ config, onClose, onRollbackSuccess }) {
  const [rollingBack, setRollingBack] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [verToRollback, setVerToRollback] = useState(null);

  if (!config) return null;

  const handleConfirmRollback = async () => {
    if (!verToRollback) return;

    setRollingBack(true);
    try {
      const res = await api.configs.rollback(config.id, verToRollback);
      setSuccessMsg(res.message);
      setVerToRollback(null);
      setTimeout(() => {
        onRollbackSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      alert(`Rollback failed: ${err.message}`);
      setRollingBack(false);
    }
  };

  const versions = config.versions || [];

  return (
    <div className="neo-modal-overlay" onClick={onClose}>
      <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="neo-modal-header neo-modal-header-violet" style={{
          padding: '20px 24px',
          borderBottom: 'var(--neo-border-4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--neo-violet)',
          color: '#000000'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: '#000', color: '#FFF' }}>
              <History size={20} color="#FFF" strokeWidth={3} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#000000', margin: 0 }}>SECRET VERSION HISTORY</h3>
            </div>
          </div>
          <button onClick={onClose} className="btn-neo-outline" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px', fontSize: '0.85rem', fontWeight: 800 }}>
            KEY: <code className="font-mono" style={{ background: '#000', color: 'var(--neo-yellow)', padding: '2px 8px', border: '1px solid #000' }}>{config.key}</code> ({config.environment.toUpperCase()})
          </div>
          {successMsg && (
            <div style={{
              background: 'var(--neo-green)',
              border: 'var(--neo-border-4)',
              boxShadow: '4px 4px 0px #000',
              padding: '12px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 900,
              fontSize: '0.88rem'
            }}>
              <Check size={18} strokeWidth={3} />
              <span>{successMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {versions.map((ver) => {
              const isCurrent = ver.version_number === config.currentVersionNumber;

              return (
                <div
                  key={ver.id || ver.version_number}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    background: isCurrent ? 'var(--neo-yellow)' : 'var(--neo-surface-2)',
                    color: isCurrent ? '#000000' : 'var(--neo-black)',
                    border: 'var(--neo-border-4)',
                    boxShadow: 'var(--neo-shadow-sm)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="font-mono" style={{ fontWeight: 900, fontSize: '1rem' }}>
                        VERSION {ver.version_number}
                      </span>
                      {isCurrent && (
                        <span className="neo-badge neo-badge-green" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, marginTop: '4px' }}>
                      TIMESTAMP: {new Date(ver.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div>
                    {isCurrent ? (
                      <span className="neo-badge neo-badge-white" style={{ fontSize: '0.74rem' }}>
                        CURRENT
                      </span>
                    ) : (
                      <button
                        onClick={() => setVerToRollback(ver.version_number)}
                        disabled={rollingBack}
                        className="btn-neo-outline"
                        style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                      >
                        <RotateCcw size={13} strokeWidth={3} />
                        <span>ROLLBACK</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rollback Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(verToRollback)}
        title="Rollback Secret Version"
        message={`Are you sure you want to rollback "${config.key}" to version ${verToRollback}?`}
        warningNote="This will create a new immutable version with the decrypted value restored from that historical revision."
        confirmText="Yes, Rollback"
        danger={false}
        loading={rollingBack}
        onConfirm={handleConfirmRollback}
        onClose={() => setVerToRollback(null)}
      />
    </div>
  );
}
