import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import ExportConfigModal from './ExportConfigModal.jsx';
import ImportEnvModal from './ImportEnvModal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import {
  Key,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Lock,
  Layers,
  Zap
} from 'lucide-react';

export default function ConfigsManager({
  projects,
  activeProjectId,
  activeApplicationId,
  sensitiveClipboard
}) {
  const [activeTab, setActiveTab] = useState('production'); // 'production' | 'staging' | 'development'
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revealedMap, setRevealedMap] = useState({});
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Delete confirmation modal state
  const [configToDelete, setConfigToDelete] = useState(null);
  const [deletingConfig, setDeletingConfig] = useState(false);

  // New config form state
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newIsSecret, setNewIsSecret] = useState(true);
  const [selectedEnvironments, setSelectedEnvironments] = useState(['production']);
  const [savingNew, setSavingNew] = useState(false);

  const handleOpenAdd = () => {
    setSelectedEnvironments([activeTab]);
    setNewKey('');
    setNewValue('');
    setIsAddOpen(true);
  };

  const fetchConfigs = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    try {
      const res = await api.configs.list({
        projectId: activeProjectId || undefined,
        applicationId: activeApplicationId || undefined,
        environment: activeTab,
        decrypt: 'true'
      });
      setConfigs(res);
    } catch (err) {
      console.error('Failed to load configs:', err);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
    const interval = setInterval(() => fetchConfigs(true), 10000);
    return () => clearInterval(interval);
  }, [activeProjectId, activeApplicationId, activeTab]);

  const toggleReveal = (id) => {
    setRevealedMap(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleConfirmDelete = async () => {
    if (!configToDelete) return;
    setDeletingConfig(true);
    try {
      await api.configs.delete(configToDelete.id);
      setConfigs(prev => prev.filter(c => c.id !== configToDelete.id));
      setConfigToDelete(null);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingConfig(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newKey.trim()) return;
    if (selectedEnvironments.length === 0) {
      alert('Please select at least one target environment.');
      return;
    }

    setSavingNew(true);
    try {
      await api.configs.create({
        project_id: activeProjectId,
        application_id: activeApplicationId || null,
        environments: selectedEnvironments,
        environment: selectedEnvironments[0],
        key: newKey.trim(),
        value: newValue,
        is_secret: newIsSecret
      });
      setNewKey('');
      setNewValue('');
      setIsAddOpen(false);
      fetchConfigs();
    } catch (err) {
      alert(`Failed to create secret: ${err.message}`);
    } finally {
      setSavingNew(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900 }}>
            SECRETS & ENVIRONMENT
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            id="btn-open-export"
            onClick={() => setIsExportOpen(true)}
            className="btn-neo-outline"
          >
            <Download size={15} strokeWidth={3} />
            <span>Export</span>
          </button>

          <button
            id="btn-open-import"
            onClick={() => setIsImportOpen(true)}
            className="btn-neo-secondary"
          >
            <Upload size={15} strokeWidth={3} />
            <span>Import .env</span>
          </button>

          <button
            id="btn-add-secret"
            onClick={handleOpenAdd}
            className="btn-neo-primary"
          >
            <Plus size={16} strokeWidth={3} />
            <span>Add Secret</span>
          </button>
        </div>
      </div>

      {/* Environment Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--neo-border-4)', paddingBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[
            { id: 'production', label: 'Production' },
            { id: 'staging', label: 'Staging' },
            { id: 'development', label: 'Development' }
          ].map(env => (
            <button
              key={env.id}
              id={`tab-env-${env.id}`}
              onClick={() => setActiveTab(env.id)}
              className={activeTab === env.id ? 'btn-neo-secondary' : 'btn-neo-outline'}
              style={{ padding: '8px 16px', fontSize: '0.86rem' }}
            >
              {env.label}
            </button>
          ))}
        </div>

        <button
          onClick={fetchConfigs}
          className="btn-neo-outline"
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
        >
          <RefreshCw size={13} strokeWidth={3} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Table / View Area */}
      <div className="neo-card-static" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', fontWeight: 900 }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} strokeWidth={3} />
            <span>DECRYPTING SECRETS WITH AES-256-GCM...</span>
          </div>
        ) : configs.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="neo-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Variable Key</th>
                  <th style={{ textAlign: 'left' }}>Value Payload</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {configs.map(cfg => {
                  const isRevealed = revealedMap[cfg.id];
                  const plainVal = cfg.decrypted_value || '';
                  const isCopied = sensitiveClipboard.isCopied(cfg.key);

                  return (
                    <tr key={cfg.id}>
                      {/* Key */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Lock size={15} strokeWidth={3} />
                          <code className="font-mono" style={{ fontWeight: 900, fontSize: '0.92rem' }}>
                            {cfg.key}
                          </code>
                        </div>
                      </td>

                      {/* Value with Hide/Reveal & 45s Sensitive Clipboard */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="font-mono" style={{
                            background: isRevealed ? 'var(--neo-yellow)' : '#E2E8F0',
                            border: '2px solid #000',
                            padding: '4px 10px',
                            fontWeight: 900,
                            fontSize: '0.84rem',
                            color: '#000'
                          }}>
                            {isRevealed ? plainVal : '••••••••••••••••••••••••'}
                          </span>
                          <button
                            onClick={() => toggleReveal(cfg.id)}
                            className="btn-neo-outline"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            title={isRevealed ? 'Mask value' : 'Decrypt value'}
                          >
                            {isRevealed ? <EyeOff size={13} strokeWidth={3} /> : <Eye size={13} strokeWidth={3} />}
                          </button>
                          <button
                            id={`btn-copy-secret-${cfg.key}`}
                            onClick={() => sensitiveClipboard.copySecret(plainVal, cfg.key)}
                            className={isCopied ? 'btn-neo-primary' : 'btn-neo-outline'}
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            title="Copy secret (auto-clears in 45s)"
                          >
                            {isCopied ? (
                              <>
                                <Check size={13} strokeWidth={3} />
                                <span>{sensitiveClipboard.secondsLeft}S</span>
                              </>
                            ) : (
                              <Copy size={13} strokeWidth={3} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setConfigToDelete({ id: cfg.id, key: cfg.key })}
                          className="btn-neo-danger"
                          style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                          title="Delete secret"
                        >
                          <Trash2 size={13} strokeWidth={3} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Key size={36} strokeWidth={3} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>NO SECRETS IN {activeTab.toUpperCase()} STAGE</div>
            <button
              onClick={handleOpenAdd}
              className="btn-neo-primary"
              style={{ marginTop: '16px' }}
            >
              <Plus size={15} strokeWidth={3} /> Add First Secret
            </button>
          </div>
        )}
      </div>

      {/* Add Secret Modal */}
      {isAddOpen && (
        <div className="neo-modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="neo-modal-header neo-modal-header-yellow" style={{ padding: '20px 24px', borderBottom: 'var(--neo-border-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--neo-yellow)', color: '#000000' }}>
              <h3 style={{ fontSize: '1.25rem', color: '#000000', margin: 0, fontWeight: 900 }}>ADD ENCRYPTED SECRET</h3>
              <button onClick={() => setIsAddOpen(false)} className="btn-neo-outline" style={{ padding: '4px 8px' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: '24px' }}>
              {/* Target Environments Multi-Select */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900 }}>
                    TARGET ENVIRONMENTS (MULTI-SELECT)
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedEnvironments(['production', 'staging', 'development'])}
                      className="btn-neo-outline"
                      style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                    >
                      SELECT ALL
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEnvironments([])}
                      className="btn-neo-outline"
                      style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                    >
                      CLEAR
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { id: 'production', label: 'PRODUCTION', badge: 'LIVE', borderActive: 'var(--neo-red)', colorActive: 'var(--neo-red)' },
                    { id: 'staging', label: 'STAGING', badge: 'TEST', borderActive: 'var(--neo-yellow)', colorActive: 'var(--neo-yellow)' },
                    { id: 'development', label: 'DEVELOPMENT', badge: 'LOCAL', borderActive: 'var(--neo-cyan)', colorActive: 'var(--neo-cyan)' }
                  ].map(env => {
                    const isSelected = selectedEnvironments.includes(env.id);
                    return (
                      <div
                        key={env.id}
                        id={`select-env-${env.id}`}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedEnvironments(selectedEnvironments.filter(e => e !== env.id));
                          } else {
                            setSelectedEnvironments([...selectedEnvironments, env.id]);
                          }
                        }}
                        style={{
                          border: isSelected ? `3px solid ${env.borderActive}` : '3px solid #2B2E37',
                          background: isSelected ? 'var(--neo-surface-3)' : 'var(--neo-surface-1)',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          userSelect: 'none',
                          transition: 'all 120ms ease',
                          boxShadow: isSelected ? '4px 4px 0px #090A0D' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 900, color: isSelected ? env.colorActive : 'var(--neo-black)' }}>
                            {env.label}
                          </span>
                          <span style={{
                            width: '18px',
                            height: '18px',
                            border: '2px solid #000',
                            background: isSelected ? env.borderActive : '#000',
                            color: '#000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 900
                          }}>
                            {isSelected ? '✓' : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 800, opacity: 0.7, color: 'var(--neo-black)' }}>
                          STAGE: {env.badge}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedEnvironments.length === 0 && (
                  <div style={{ color: 'var(--neo-red)', fontSize: '0.78rem', fontWeight: 800, marginTop: '8px' }}>
                    ⚠️ Please select at least one target environment.
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, marginBottom: '8px' }}>
                  VARIABLE KEY (E.G. STRIPE_API_KEY)
                </label>
                <input
                  id="input-new-secret-key"
                  type="text"
                  required
                  placeholder="STRIPE_SECRET_KEY"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="neo-input font-mono"
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, marginBottom: '8px' }}>
                  RAW SECRET VALUE
                </label>
                <textarea
                  id="textarea-new-secret-val"
                  rows={3}
                  required
                  placeholder="Enter secret to encrypt with AES-256-GCM..."
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="neo-input font-mono"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <input
                  id="checkbox-is-secret"
                  type="checkbox"
                  checked={newIsSecret}
                  onChange={(e) => setNewIsSecret(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: '#000' }}
                />
                <label htmlFor="checkbox-is-secret" style={{ fontSize: '0.88rem', fontWeight: 900 }}>
                  ENCRYPT WITH AES-256-GCM
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn-neo-outline">
                  Cancel
                </button>
                <button
                  id="btn-submit-new-secret"
                  type="submit"
                  disabled={savingNew}
                  className="btn-neo-primary"
                >
                  {savingNew ? 'Encrypting...' : 'Save Secret'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {isExportOpen && (
        <ExportConfigModal
          projectId={activeProjectId}
          applicationId={activeApplicationId}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {/* Import Modal */}
      {isImportOpen && (
        <ImportEnvModal
          projects={projects}
          activeProjectId={activeProjectId}
          activeApplicationId={activeApplicationId}
          onClose={() => setIsImportOpen(false)}
          onImportSuccess={fetchConfigs}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(configToDelete)}
        title="Delete Secret"
        message={`Are you sure you want to permanently delete "${configToDelete?.key}" from ${activeTab.toUpperCase()}?`}
        warningNote="All version history and encrypted values for this key will be permanently purged."
        confirmText="Yes, Delete Secret"
        loading={deletingConfig}
        onConfirm={handleConfirmDelete}
        onClose={() => setConfigToDelete(null)}
      />
    </div>
  );
}
