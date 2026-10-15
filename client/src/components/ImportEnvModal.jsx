import React, { useState } from 'react';
import { api } from '../services/api.js';
import { Upload, X, Check, AlertCircle, RefreshCw } from 'lucide-react';

export default function ImportEnvModal({ projects, activeProjectId, activeApplicationId, onClose, onImportSuccess }) {
  const [projectId, setProjectId] = useState(activeProjectId || (projects[0]?.id || ''));
  const [applicationId, setApplicationId] = useState(activeApplicationId || '');
  const [environment, setEnvironment] = useState('production');
  const [envContent, setEnvContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const activeProj = projects.find(p => p.id === projectId);
  const apps = activeProj?.applications || [];

  const handleImport = async (e) => {
    e.preventDefault();
    if (!envContent.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.configs.import({
        project_id: projectId,
        application_id: applicationId || null,
        environment,
        envContent
      });
      setResult(res);
      setTimeout(() => {
        onImportSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Import failed');
      setLoading(false);
    }
  };

  return (
    <div className="neo-modal-overlay" onClick={onClose}>
      <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        <div className="neo-modal-header neo-modal-header-yellow" style={{ padding: '18px 24px', background: 'var(--neo-yellow)', color: '#000000', borderBottom: 'var(--neo-border-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '6px', background: '#000', border: '2px solid #000', display: 'flex' }}>
              <Upload size={20} color="var(--neo-yellow)" strokeWidth={3} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', margin: 0 }}>
                Bulk .env Secrets Import
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="btn-neo-outline" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleImport} style={{ padding: '24px' }}>
          {error && (
            <div style={{
              background: 'var(--neo-red)',
              border: 'var(--neo-border-4)',
              boxShadow: 'var(--neo-shadow-sm)',
              padding: '12px 16px',
              marginBottom: '20px',
              color: '#000000',
              fontWeight: 900,
              fontSize: '0.88rem'
            }}>
              ERROR: {error}
            </div>
          )}

          {result && (
            <div style={{
              background: 'var(--neo-green)',
              border: 'var(--neo-border-4)',
              boxShadow: 'var(--neo-shadow-sm)',
              padding: '12px 16px',
              marginBottom: '20px',
              color: '#000000',
              fontWeight: 900,
              fontSize: '0.88rem'
            }}>
              SUCCESS: IMPORTED {result.totalProcessed} VARIABLES! ENCRYPTED IN DEV BOX VAULT.
            </div>
          )}

          {/* Scope Selectors */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setApplicationId('');
                }}
                className="neo-input"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                Application Scope
              </label>
              <select
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                className="neo-input"
              >
                <option value="">SHARED (PROJECT WIDE)</option>
                {apps.map(a => (
                  <option key={a.id} value={a.id}>{a.name.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                Environment
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="neo-input"
              >
                <option value="production">PRODUCTION</option>
                <option value="staging">STAGING</option>
                <option value="development">DEVELOPMENT</option>
              </select>
            </div>
          </div>

          {/* .env Content Box */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
              Paste .env Key-Value Content:
            </label>
            <textarea
              id="textarea-env-import"
              rows={8}
              value={envContent}
              onChange={(e) => setEnvContent(e.target.value)}
              placeholder={`# Paste environment variables\nDATABASE_URL=postgresql://user:pass@host:5432/db\nAPI_KEY=sk_live_1234567890\nREDIS_HOST=127.0.0.1`}
              className="neo-input font-mono"
              style={{ fontSize: '0.84rem', resize: 'vertical' }}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn-neo-outline">
              Cancel
            </button>
            <button
              id="btn-submit-env-import"
              type="submit"
              disabled={loading || !envContent.trim()}
              className="btn-neo-primary"
            >
              {loading ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Encrypting & Importing...</span>
                </>
              ) : (
                <>
                  <Upload size={15} />
                  <span>Parse & Ingest Secrets</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
