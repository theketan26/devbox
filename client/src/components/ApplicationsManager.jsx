import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '../services/api.js';
import {
  setActiveProject,
  setActiveApplication,
  updateApplicationInState,
  deleteApplicationFromState
} from '../store/projectsSlice.js';
import ApplicationDetailPage from './ApplicationDetailPage.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import {
  Cpu,
  Plus,
  ExternalLink,
  GitBranch,
  Trash2,
  Edit2,
  Globe,
  Key,
  Activity,
  Link2,
  HardDrive,
  RefreshCw,
  FolderKanban,
  ArrowRight,
  AlertTriangle,
  X
} from 'lucide-react';

export default function ApplicationsManager({
  projects,
  activeProjectId,
  activeApplicationId,
  setActiveTab,
  onOpenNewApplication,
  sensitiveClipboard
}) {
  const dispatch = useDispatch();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppId, setSelectedAppId] = useState(activeApplicationId || null);

  // Deployment form modal state
  const [addDepAppId, setAddDepAppId] = useState(null);
  const [depEnvironment, setDepEnvironment] = useState('production');
  const [depUrl, setDepUrl] = useState('');
  const [savingDep, setSavingDep] = useState(false);

  // Edit app state
  const [editingApp, setEditingApp] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRepoUrl, setEditRepoUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation modal state
  const [appToDelete, setAppToDelete] = useState(null);
  const [deletingApp, setDeletingApp] = useState(false);
  const [depToDelete, setDepToDelete] = useState(null);
  const [deletingDep, setDeletingDep] = useState(false);

  const fetchApplications = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    try {
      const res = await api.applications.list(activeProjectId || undefined);
      setApplications(res);
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    const interval = setInterval(() => fetchApplications(true), 10000);
    return () => clearInterval(interval);
  }, [activeProjectId]);

  const handleSelectApp = (app) => {
    dispatch(setActiveProject(app.project_id));
    dispatch(setActiveApplication(app.id));
    setSelectedAppId(app.id);
  };

  const handleDeleteApp = (app) => {
    setAppToDelete(app);
  };

  const handleConfirmDeleteApp = async () => {
    if (!appToDelete) return;
    setDeletingApp(true);
    try {
      await api.applications.delete(appToDelete.id);
      dispatch(deleteApplicationFromState(appToDelete.id));
      if (selectedAppId === appToDelete.id) setSelectedAppId(null);
      if (activeApplicationId === appToDelete.id) dispatch(setActiveApplication(null));
      setAppToDelete(null);
      fetchApplications();
    } catch (err) {
      alert(`Failed to delete application: ${err.message}`);
    } finally {
      setDeletingApp(false);
    }
  };

  const handleAddDeployment = async (e) => {
    e.preventDefault();
    if (!depUrl.trim() || !addDepAppId) return;

    setSavingDep(true);
    try {
      await api.applications.addDeployment(addDepAppId, {
        environment: depEnvironment,
        url: depUrl.trim()
      });
      setDepUrl('');
      setAddDepAppId(null);
      fetchApplications();
    } catch (err) {
      alert(`Failed to add deployment URL: ${err.message}`);
    } finally {
      setSavingDep(false);
    }
  };

  const handleConfirmDeleteDep = async () => {
    if (!depToDelete) return;
    setDeletingDep(true);
    try {
      await api.applications.deleteDeployment(depToDelete.appId, depToDelete.depId);
      fetchApplications();
      setDepToDelete(null);
    } catch (err) {
      alert(`Failed to delete deployment URL: ${err.message}`);
    } finally {
      setDeletingDep(false);
    }
  };

  const handleStartEdit = (app) => {
    setEditingApp(app);
    setEditName(app.name);
    setEditDescription(app.description || '');
    setEditRepoUrl(app.repo_url || '');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim() || !editingApp) return;

    setSavingEdit(true);
    try {
      const updated = await api.applications.update(editingApp.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        repo_url: editRepoUrl.trim()
      });
      dispatch(updateApplicationInState(updated));
      setEditingApp(null);
      fetchApplications();
    } catch (err) {
      alert(`Failed to update application: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'healthy':
        return <span className="neo-badge neo-badge-green">HEALTHY</span>;
      case 'down':
        return <span className="neo-badge neo-badge-red">DOWN</span>;
      case 'maintenance':
        return <span className="neo-badge neo-badge-violet">MAINTENANCE</span>;
      default:
        return <span className="neo-badge neo-badge-white">STANDBY</span>;
    }
  };

  // If a specific application is selected, render the dedicated Application Details Page
  if (selectedAppId) {
    return (
      <ApplicationDetailPage
        applicationId={selectedAppId}
        projects={projects}
        onBack={() => setSelectedAppId(null)}
        sensitiveClipboard={sensitiveClipboard}
        onApplicationUpdated={fetchApplications}
        onApplicationDeleted={() => {
          setSelectedAppId(null);
          fetchApplications();
        }}
      />
    );
  }

  const activeProjectObj = projects.find(p => p.id === activeProjectId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.05 }}>
            APPLICATIONS
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={fetchApplications}
            className="btn-neo-outline"
            title="Refresh application list"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            id="btn-register-new-app"
            onClick={onOpenNewApplication}
            className="btn-neo-cyan"
          >
            <Plus size={16} strokeWidth={3} />
            <span>Register Application</span>
          </button>
        </div>
      </div>

      {/* Applications Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '22px' }}>
        {applications.map(app => {
          const parentProject = projects.find(p => p.id === app.project_id);

          return (
            <div
              key={app.id}
              className="neo-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '24px',
                minHeight: '280px',
                borderColor: 'var(--neo-border-color)'
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      background: 'var(--neo-cyan)',
                      border: 'var(--neo-border-4)',
                      boxShadow: 'var(--neo-shadow-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Cpu size={22} color="#000" strokeWidth={3} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase' }}>
                        {app.name}
                      </h3>
                      {parentProject && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--neo-black)', opacity: 0.7 }}>
                          <FolderKanban size={12} strokeWidth={3} />
                          <span>{parentProject.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {getStatusBadge(app.currentStatus)}
                    <button
                      onClick={() => handleStartEdit(app)}
                      className="btn-neo-outline"
                      style={{ padding: '4px 7px' }}
                      title="Edit"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteApp(app)}
                      className="btn-neo-danger"
                      style={{ padding: '4px 7px' }}
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {app.description && (
                  <p style={{
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    color: 'var(--neo-black)',
                    opacity: 0.8,
                    lineHeight: 1.4,
                    marginBottom: '14px'
                  }}>
                    {app.description}
                  </p>
                )}

                {/* Repo Link */}
                {app.repo_url && (
                  <div style={{ marginBottom: '14px' }}>
                    <a
                      href={app.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: 'var(--neo-cyan)',
                        textDecoration: 'underline'
                      }}
                    >
                      <GitBranch size={12} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                        {app.repo_url}
                      </span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                )}

                {/* Deployed URLs */}
                {app.deployments && app.deployments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                    {app.deployments.slice(0, 2).map(dep => (
                      <div
                        key={dep.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--neo-canvas)',
                          border: '2px solid #000',
                          padding: '4px 8px',
                          fontSize: '0.76rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                          <span className={`neo-badge ${dep.environment === 'production' ? 'neo-badge-red' : 'neo-badge-yellow'}`} style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                            {dep.environment}
                          </span>
                          <span className="font-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                            {dep.url}
                          </span>
                        </div>
                        <a
                          href={dep.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-neo-primary"
                          style={{ padding: '2px 6px', fontSize: '0.68rem', textDecoration: 'none' }}
                        >
                          Visit
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer: Open Application Details */}
              <div style={{
                paddingTop: '16px',
                borderTop: 'var(--neo-border-4)',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center'
              }}>
                <button
                  id={`btn-open-app-${app.id}`}
                  onClick={() => handleSelectApp(app)}
                  className="btn-neo-primary"
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.86rem' }}
                >
                  <span>Open Application Details</span>
                  <ArrowRight size={15} strokeWidth={3} />
                </button>
              </div>
            </div>
          );
        })}

        {applications.length === 0 && !loading && (
          <div className="neo-card-yellow" style={{ padding: '48px', textAlign: 'center', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '8px' }}>
              NO APPLICATIONS REGISTERED
            </h3>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '20px' }}>
              Register your microservices, APIs, and client applications to manage secrets, health probes, links and files.
            </p>
            <button
              onClick={onOpenNewApplication}
              className="btn-neo-primary"
            >
              <Plus size={16} strokeWidth={3} />
              <span>Register First Application</span>
            </button>
          </div>
        )}
      </div>

      {/* Edit Application Modal (Bluish) */}
      {editingApp && (
        <div className="neo-modal-overlay" onClick={() => setEditingApp(null)}>
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
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', margin: 0 }}>
                  Edit Application Details
                </h3>
              </div>
              <button onClick={() => setEditingApp(null)} className="btn-neo-outline" style={{ padding: '6px' }}>
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
                <button type="button" onClick={() => setEditingApp(null)} className="btn-neo-outline">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-neo-primary"
                >
                  {savingEdit ? 'Saving...' : 'Update Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Application Confirmation Modal */}
      {appToDelete && (
        <div className="neo-modal-overlay" onClick={() => setAppToDelete(null)}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="neo-modal-header neo-modal-header-red" style={{
              padding: '18px 24px',
              background: 'var(--neo-red)',
              color: '#000000',
              borderBottom: 'var(--neo-border-4)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', margin: 0 }}>
                Delete Application
              </h3>
              <button onClick={() => setAppToDelete(null)} className="btn-neo-outline" style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <p style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '14px', lineHeight: 1.5 }}>
                Are you sure you want to delete <span style={{ textDecoration: 'underline' }}>{appToDelete.name}</span>?
              </p>
              <div style={{
                background: '#2A0808',
                border: 'var(--neo-border-3)',
                borderColor: 'var(--neo-red)',
                color: 'var(--neo-red)',
                padding: '12px 14px',
                fontWeight: 700,
                fontSize: '0.84rem',
                marginBottom: '24px',
                lineHeight: 1.4,
                display: 'flex',
                gap: '10px'
              }}>
                <AlertTriangle size={20} color="var(--neo-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>WARNING:</strong> This will permanently delete <strong>{appToDelete.name}</strong> along with all its secrets, health check probes, resource links, and uploaded files.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setAppToDelete(null)} className="btn-neo-outline">
                  Cancel
                </button>
                <button
                  id="btn-confirm-delete-app"
                  type="button"
                  onClick={handleConfirmDeleteApp}
                  disabled={deletingApp}
                  className="btn-neo-danger"
                >
                  {deletingApp ? 'Deleting...' : 'Yes, Delete Application'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Deployment Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(depToDelete)}
        title="Remove Deployment Endpoint"
        message="Are you sure you want to remove this deployment URL?"
        warningNote="This endpoint mapping will be removed from this application."
        confirmText="Remove Endpoint"
        loading={deletingDep}
        onConfirm={handleConfirmDeleteDep}
        onClose={() => setDepToDelete(null)}
      />
    </div>
  );
}
