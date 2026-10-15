import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Download, Copy, Check, X, FileText, Layers } from 'lucide-react';

export default function ExportConfigModal({ projectId, applicationId, onClose }) {
  const [format, setFormat] = useState('dotenv');
  const [environment, setEnvironment] = useState('production');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchExport = async () => {
    setLoading(true);
    try {
      const res = await api.configs.export({
        projectId: projectId || undefined,
        applicationId: applicationId || undefined,
        environment,
        format
      });
      setContent(res);
    } catch (err) {
      setContent(`# Error exporting configurations: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExport();
  }, [format, environment, projectId, applicationId]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const extensions = {
      dotenv: '.env',
      json: '.json',
      docker: '-docker.env',
      k8s: '-k8s-secret.yaml'
    };
    const filename = `${environment}${extensions[format] || '.txt'}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="neo-modal-overlay" onClick={onClose}>
      <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        <div className="neo-modal-header neo-modal-header-violet" style={{ padding: '18px 24px', background: 'var(--neo-violet)', borderBottom: 'var(--neo-border-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#000000' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '6px', background: 'var(--neo-yellow)', border: '2px solid #000', display: 'flex' }}>
              <Download size={20} color="#000" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', margin: 0 }}>
                Multi-Format Config Export
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="btn-neo-outline" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Format & Environment Selectors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                Environment Stage
              </label>
              <select
                id="select-export-env"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="neo-input"
              >
                <option value="production">PRODUCTION</option>
                <option value="staging">STAGING</option>
                <option value="development">DEVELOPMENT</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                Target Export Format
              </label>
              <select
                id="select-export-format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="neo-input"
              >
                <option value="dotenv">Standard .env (DotEnv)</option>
                <option value="json">JSON Key-Value Object</option>
                <option value="docker">Docker Compose Environment</option>
                <option value="k8s">Kubernetes Secret (YAML / Base64)</option>
              </select>
            </div>
          </div>

          {/* Code Preview Box */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase' }}>Decrypted Payload Preview:</span>
              <span className="neo-badge neo-badge-yellow">
                {format.toUpperCase()}
              </span>
            </div>
            <textarea
              readOnly
              value={loading ? 'Decrypting and generating payload...' : content}
              className="neo-input font-mono"
              rows={11}
              style={{
                fontSize: '0.84rem',
                background: '#000000',
                color: '#4ADE80',
                resize: 'none',
                lineHeight: '1.5',
                border: 'var(--neo-border-4)'
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              id="btn-copy-export"
              onClick={handleCopy}
              className="btn-neo-secondary"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Content'}</span>
            </button>

            <button
              id="btn-download-export"
              onClick={handleDownload}
              className="btn-neo-primary"
            >
              <Download size={16} />
              <span>Download File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
