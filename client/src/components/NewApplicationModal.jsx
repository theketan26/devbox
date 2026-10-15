import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '../services/api.js';
import { setActiveApplication } from '../store/projectsSlice.js';
import { Cpu, X, Plus, Globe, GitBranch } from 'lucide-react';

export default function NewApplicationModal({ projects, activeProjectId, onClose, onCreated }) {
  const dispatch = useDispatch();
  const [projectId, setProjectId] = useState(activeProjectId || (projects[0]?.id || ''));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [prodUrl, setProdUrl] = useState('');
  const [stagingUrl, setStagingUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !projectId) return;

    setLoading(true);
    setError(null);
    try {
      const created = await api.applications.create({
        project_id: projectId,
        name: name.trim(),
        description: description.trim(),
        repo_url: repoUrl.trim()
      });

      // Optionally add initial deployment URLs
      if (prodUrl.trim()) {
        try {
          await api.applications.addDeployment(created.id, {
            environment: 'production',
            url: prodUrl.trim()
          });
        } catch (err) {
          console.error('Failed to register initial production URL:', err);
        }
      }

      if (stagingUrl.trim()) {
        try {
          await api.applications.addDeployment(created.id, {
            environment: 'staging',
            url: stagingUrl.trim()
          });
        } catch (err) {
          console.error('Failed to register initial staging URL:', err);
        }
      }

      dispatch(setActiveApplication(created.id));
      if (onCreated) {
        onCreated(created);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="neo-modal-overlay" onClick={onClose}>
      <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="neo-modal-header neo-modal-header-cyan" style={{
          padding: '18px 24px',
          background: 'var(--neo-cyan)',
          color: '#000000',
          borderBottom: 'var(--neo-border-4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#000', padding: '6px', display: 'flex' }}>
              <Cpu size={22} color="var(--neo-cyan)" strokeWidth={3} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', margin: 0 }}>
                Register New Application
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="btn-neo-outline" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div style={{
              background: 'var(--neo-red)',
              border: 'var(--neo-border-4)',
              boxShadow: 'var(--neo-shadow-sm)',
              padding: '12px',
              marginBottom: '18px',
              fontWeight: 900,
              fontSize: '0.86rem',
              color: '#000'
            }}>
              ERROR: {error}
            </div>
          )}

          {/* Project Target */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
              Target Project
            </label>
            <select
              id="select-target-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="neo-input font-mono"
              required
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Application Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
              Application Name *
            </label>
            <input
              id="input-app-name"
              type="text"
              required
              placeholder="e.g. Storefront Web / Auth Service"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="neo-input"
              autoFocus
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
              Description / Architecture Role
            </label>
            <input
              id="input-app-description"
              type="text"
              placeholder="e.g. Customer-facing Next.js application running on Edge"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="neo-input"
            />
          </div>

          {/* Repo URL */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
              Git Repository URL
            </label>
            <input
              id="input-app-repo"
              type="url"
              placeholder="https://github.com/organization/repo-name"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="neo-input font-mono"
            />
          </div>

          {/* Optional Initial Deployments */}
          <div style={{
            background: 'var(--neo-white)',
            border: 'var(--neo-border-2)',
            padding: '14px',
            marginBottom: '24px'
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px' }}>
              Initial Deployed URLs (Optional)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Production URL
                </label>
                <input
                  type="url"
                  placeholder="https://app.domain.com"
                  value={prodUrl}
                  onChange={(e) => setProdUrl(e.target.value)}
                  className="neo-input font-mono"
                  style={{ fontSize: '0.82rem', padding: '8px 10px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Staging URL
                </label>
                <input
                  type="url"
                  placeholder="https://staging.domain.com"
                  value={stagingUrl}
                  onChange={(e) => setStagingUrl(e.target.value)}
                  className="neo-input font-mono"
                  style={{ fontSize: '0.82rem', padding: '8px 10px' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn-neo-outline">
              Cancel
            </button>
            <button
              id="btn-submit-new-app"
              type="submit"
              disabled={loading}
              className="btn-neo-primary"
            >
              {loading ? 'Creating Application...' : 'Create Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
