import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '../services/api.js';
import { updateApplicationInState, deleteApplicationFromState } from '../store/projectsSlice.js';
import ConfigsManager from './ConfigsManager.jsx';
import HealthCheckMonitor from './HealthCheckMonitor.jsx';
import LinksHub from './LinksHub.jsx';
import ApplicationFilesManager from './ApplicationFilesManager.jsx';
import {
  ArrowLeft,
  Cpu,
  Key,
  Activity,
  Link2,
  HardDrive,
  GitBranch,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  Globe,
  FolderKanban,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X
} from 'lucide-react';

export default function ApplicationDetailPage({
  applicationId,
  projects,
  onBack,
  sensitiveClipboard,
  onApplicationUpdated,
  onApplicationDeleted
}) {
  const dispatch = useDispatch();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('secrets'); // 'secrets' | 'health' | 'links' | 'files'

  // Deployment form modal
  const [isAddDepOpen, setIsAddDepOpen] = useState(false);
  const [depEnvironment, setDepEnvironment] = useState('production');
  const [depUrl, setDepUrl] = useState('');
  const [savingDep, setSavingDep] = useState(false);

  // Edit app modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRepoUrl, setEditRepoUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchAppDetails = async (isPoll = false) => {
    if (!applicationId) return;
    if (!isPoll) setLoading(true);
    try {
      const res = await api.applications.get(applicationId);
      setApp(res);
      setEditName(res.name);
      setEditDescription(res.description || '');
      setEditRepoUrl(res.repo_url || '');
    } catch (err) {
      console.error('Failed to load application details:', err);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppDetails();
    const interval = setInterval(() => fetchAppDetails(true), 10000);
    return () => clearInterval(interval);
  }, [applicationId]);

  const handleAddDeployment = async (e) => {
    e.preventDefault();
    if (!depUrl.trim() || !app) return;

    setSavingDep(true);
    try {
      await api.applications.addDeployment(app.id, {
        environment: depEnvironment,
        url: depUrl.trim()
      });
      setDepUrl('');
      setIsAddDepOpen(false);
      fetchAppDetails();
      if (onApplicationUpdated) onApplicationUpdated();
    } catch (err) {
      alert(`Failed to add deployment: ${err.message}`);
    } finally {
      setSavingDep(false);
    }
  };

  const handleDeleteDeployment = async (depId) => {
    if (!window.confirm('Delete this deployment endpoint?')) return;
    try {
      await api.applications.deleteDeployment(app.id, depId);
      fetchAppDetails();
      if (onApplicationUpdated) onApplicationUpdated();
    } catch (err) {
      alert(`Failed to delete deployment: ${err.message}`);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim() || !app) return;

    setSavingEdit(true);
    try {
      const updated = await api.applications.update(app.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        repo_url: editRepoUrl.trim()
      });
      dispatch(updateApplicationInState(updated));
      setIsEditOpen(false);
      fetchAppDetails();
      if (onApplicationUpdated) onApplicationUpdated(updated);
    } catch (err) {
      alert(`Failed to update application: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteApp = async () => {
    if (!window.confirm(`Are you sure you want to delete "${app?.name}"? All secrets, health checks, links and files will be deleted.`)) {
      return;
    }
    try {
      await api.applications.delete(app.id);
      dispatch(deleteApplicationFromState(app.id));
      if (onApplicationDeleted) onApplicationDeleted(app.id);
      if (onBack) onBack();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  if (loading && !app) {
    return (
      <div className="neo-card-cyan" style={{ padding: '40px', textAlign: 'center', fontWeight: 900 }}>
        LOADING APPLICATION DETAILS...
      </div>
    );
  }

  if (!app) {
    return (
      <div className="neo-card-red" style={{ padding: '40px', textAlign: 'center', fontWeight: 900 }}>
        APPLICATION NOT FOUND.
        <div style={{ marginTop: '16px' }}>
          <button onClick={onBack} className="btn-neo-outline">
            ← Return to Applications List
          </button>
        </div>
      </div>
    );
  }

  const parentProject = projects.find(p => p.id === app.project_id);

  const subTabs = [
    { id: 'secrets', label: 'Secrets & Parity', icon: Key },
    { id: 'health', label: 'Health Probes', icon: Activity },
    { id: 'links', label: 'Resource Links', icon: Link2 },
    { id: 'files', label: 'Application Files', icon: HardDrive }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Back Button & Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={onBack}
          className="btn-neo-outline"
          style={{ padding: '7px 14px', fontSize: '0.82rem' }}
        >
          <ArrowLeft size={16} strokeWidth={3} />
          <span>Back to Applications</span>
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsEditOpen(true)}
            className="btn-neo-secondary"
            style={{ padding: '7px 14px', fontSize: '0.82rem' }}
          >
            <Edit2 size={14} />
            <span>Edit Application</span>
          </button>

          <button
            onClick={handleDeleteApp}
            className="btn-neo-danger"
            style={{ padding: '7px 14px', fontSize: '0.82rem' }}
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="neo-card-static" style={{ padding: '24px', background: 'var(--neo-white)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'var(--neo-cyan)',
              border: 'var(--neo-border-4)',
              boxShadow: 'var(--neo-shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Cpu size={30} color="#000" strokeWidth={3} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
                  {app.name}
                </h1>
                <span className="neo-badge neo-badge-green">
                  ACTIVE
                </span>
                {parentProject && (
                  <span className="neo-badge neo-badge-yellow">
                    <FolderKanban size={12} strokeWidth={3} />
                    <span>{parentProject.name}</span>
                  </span>
                )}
              </div>

              {app.description && (
                <p style={{ fontSize: '0.92rem', color: 'var(--neo-black)', opacity: 0.8, fontWeight: 600, marginTop: '6px', maxWidth: '800px' }}>
                  {app.description}
                </p>
              )}

              {app.repo_url && (
                <div style={{ marginTop: '10px' }}>
                  <a
                    href={app.repo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-neo-outline"
                    style={{ padding: '4px 10px', fontSize: '0.78rem', textDecoration: 'none', display: 'inline-flex' }}
                  >
                    <GitBranch size={13} />
                    <span>{app.repo_url}</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deployed Environments Bar */}
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: 'var(--neo-border-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase' }}>
              <Globe size={15} strokeWidth={3} />
              <span>Deployed Endpoints:</span>
            </div>

            {app.deployments && app.deployments.length > 0 ? (
              app.deployments.map(dep => (
                <div
                  key={dep.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--neo-canvas)',
                    border: '2px solid #000',
                    padding: '4px 10px',
                    fontSize: '0.8rem'
                  }}
                >
                  <span className={`neo-badge ${dep.environment === 'production' ? 'neo-badge-red' : 'neo-badge-yellow'}`} style={{ fontSize: '0.66rem', padding: '2px 5px' }}>
                    {dep.environment}
                  </span>
                  <a
                    href={dep.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono"
                    style={{ fontWeight: 700, color: 'var(--neo-cyan)', textDecoration: 'none' }}
                  >
                    {dep.url}
                  </a>
                  <a
                    href={dep.url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open live endpoint"
                    style={{ color: 'var(--neo-cyan)' }}
                  >
                    <ExternalLink size={12} />
                  </a>
                  <button
                    onClick={() => handleDeleteDeployment(dep.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    title="Delete deployment"
                  >
                    <X size={12} color="#FF6B6B" />
                  </button>
                </div>
              ))
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--neo-black)', opacity: 0.7, fontWeight: 700 }}>
                No deployment URLs registered yet.
              </span>
            )}
          </div>

          <button
            onClick={() => setIsAddDepOpen(true)}
            className="btn-neo-outline"
            style={{ padding: '5px 10px', fontSize: '0.76rem' }}
          >
            <Plus size={13} />
            <span>Add URL</span>
          </button>
        </div>
      </div>

      {/* Application Sub-Tabs Bar */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: 'var(--neo-border-4)', paddingBottom: '0px', overflowX: 'auto' }}>
        {subTabs.map(tab => {
          const isActive = activeSubTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              id={`app-tab-${tab.id}`}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                fontSize: '0.88rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                background: isActive ? 'var(--neo-cyan)' : 'var(--neo-surface-1)',
                color: isActive ? '#000000' : 'var(--neo-black)',
                border: 'var(--neo-border-4)',
                borderBottom: isActive ? 'none' : 'var(--neo-border-4)',
                marginBottom: isActive ? '-4px' : '0px',
                boxShadow: isActive ? '4px -4px 0px rgba(255,255,255,0.15)' : 'none',
                cursor: 'pointer',
                transition: 'all 100ms ease'
              }}
            >
              <Icon size={16} strokeWidth={isActive ? 3 : 2.5} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panes */}
      <div style={{ marginTop: '8px' }}>
        {/* Tab 1: Secrets & Parity */}
        {activeSubTab === 'secrets' && (
          <ConfigsManager
            projects={projects}
            activeProjectId={app.project_id}
            activeApplicationId={app.id}
            sensitiveClipboard={sensitiveClipboard}
            hideHeader={true}
          />
        )}

        {/* Tab 2: Health Probes */}
        {activeSubTab === 'health' && (
          <HealthCheckMonitor
            activeApplicationId={app.id}
            hideHeader={true}
          />
        )}

        {/* Tab 3: Resource Links */}
        {activeSubTab === 'links' && (
          <LinksHub
            activeApplicationId={app.id}
            hideHeader={true}
            customTitle={`${app.name} Links`}
          />
        )}

        {/* Tab 4: Application Files */}
        {activeSubTab === 'files' && (
          <ApplicationFilesManager
            applicationId={app.id}
            applicationName={app.name}
          />
        )}
      </div>

      {/* Add Deployment Modal */}
      {isAddDepOpen && (
        <div className="neo-modal-overlay" onClick={() => setIsAddDepOpen(false)}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="neo-modal-header neo-modal-header-cyan" style={{
              padding: '18px 24px',
              background: 'var(--neo-cyan)',
              color: '#000000',
              borderBottom: 'var(--neo-border-4)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', margin: 0 }}>
                Add Deployed Endpoint
              </h3>
              <button onClick={() => setIsAddDepOpen(false)} className="btn-neo-outline" style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddDeployment} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Environment Stage
                </label>
                <select
                  value={depEnvironment}
                  onChange={(e) => setDepEnvironment(e.target.value)}
                  className="neo-input"
                >
                  <option value="production">PRODUCTION</option>
                  <option value="staging">STAGING</option>
                  <option value="preview">PREVIEW</option>
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Endpoint URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://app.apexcommerce.io"
                  value={depUrl}
                  onChange={(e) => setDepUrl(e.target.value)}
                  className="neo-input font-mono"
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsAddDepOpen(false)} className="btn-neo-outline">
                  Cancel
                </button>
                <button type="submit" disabled={savingDep} className="btn-neo-primary">
                  {savingDep ? 'Saving...' : 'Register Endpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Application Modal */}
      {isEditOpen && (
        <div className="neo-modal-overlay" onClick={() => setIsEditOpen(false)}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="neo-modal-header-cyan" style={{
              padding: '18px 24px',
              background: 'var(--neo-cyan)',
              color: '#000000',
              borderBottom: 'var(--neo-border-4)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#000000', padding: '6px', display: 'flex' }}>
                  <Cpu size={20} color="var(--neo-cyan)" strokeWidth={3} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', margin: 0 }}>
                  Edit Application Details
                </h3>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="btn-neo-outline" style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Application Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="neo-input"
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Description / Role
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="neo-input"
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Git Repository URL
                </label>
                <input
                  type="url"
                  value={editRepoUrl}
                  onChange={(e) => setEditRepoUrl(e.target.value)}
                  className="neo-input font-mono"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsEditOpen(false)} className="btn-neo-outline">
                  Cancel
                </button>
                <button type="submit" disabled={savingEdit} className="btn-neo-primary">
                  {savingEdit ? 'Saving...' : 'Update Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
