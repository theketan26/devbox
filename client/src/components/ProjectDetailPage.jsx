import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '../services/api.js';
import {
  setActiveApplication,
  updateProject,
  deleteProject,
  updateApplicationInState,
  deleteApplicationFromState
} from '../store/projectsSlice.js';
import ConfigsManager from './ConfigsManager.jsx';
import LinksHub from './LinksHub.jsx';
import ProjectFilesManager from './ProjectFilesManager.jsx';
import {
  FolderKanban,
  Cpu,
  Key,
  Link2,
  HardDrive,
  Plus,
  GitBranch,
  ExternalLink,
  ArrowRight,
  Edit2,
  Trash2,
  X,
  AlertTriangle
} from 'lucide-react';

export default function ProjectDetailPage({
  project,
  projects,
  onOpenNewApplication,
  onSelectApplication,
  sensitiveClipboard,
  onProjectUpdated,
  onProjectDeleted
}) {
  const dispatch = useDispatch();
  const [activeSubTab, setActiveSubTab] = useState('apps'); // 'apps' | 'secrets' | 'links' | 'files'

  // Edit Project Modal state
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [savingProjectEdit, setSavingProjectEdit] = useState(false);

  // Delete Project Modal state
  const [isDeleteProjectOpen, setIsDeleteProjectOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  // Edit Child Application Modal state
  const [editingApp, setEditingApp] = useState(null);
  const [editAppName, setEditAppName] = useState('');
  const [editAppDesc, setEditAppDesc] = useState('');
  const [editAppRepoUrl, setEditAppRepoUrl] = useState('');
  const [savingAppEdit, setSavingAppEdit] = useState(false);

  // Delete Child Application Modal state
  const [appToDelete, setAppToDelete] = useState(null);
  const [deletingChildApp, setDeletingChildApp] = useState(false);

  if (!project) {
    return (
      <div className="neo-card-yellow" style={{ padding: '40px', textAlign: 'center', fontWeight: 900 }}>
        NO PROJECT SELECTED.
      </div>
    );
  }

  const applications = Array.isArray(project.applications) ? project.applications : [];

  const subTabs = [
    { id: 'apps', label: `Applications (${applications.length})`, icon: Cpu },
    { id: 'secrets', label: 'Shared Secrets', icon: Key },
    { id: 'links', label: 'Resource Links', icon: Link2 },
    { id: 'files', label: 'Project Files', icon: HardDrive }
  ];

  const handleOpenApp = (appId) => {
    dispatch(setActiveApplication(appId));
    if (onSelectApplication) {
      onSelectApplication(appId);
    }
  };

  // Project Edit Handlers
  const handleOpenEditProject = () => {
    setEditProjectName(project.name);
    setEditProjectDesc(project.description || '');
    setIsEditProjectOpen(true);
  };

  const handleSaveProjectEdit = async (e) => {
    e.preventDefault();
    if (!editProjectName.trim()) return;

    setSavingProjectEdit(true);
    try {
      const updated = await api.projects.update(project.id, {
        name: editProjectName.trim(),
        description: editProjectDesc.trim()
      });
      dispatch(updateProject(updated));
      setIsEditProjectOpen(false);
      if (onProjectUpdated) onProjectUpdated(updated);
    } catch (err) {
      alert(`Failed to update project: ${err.message}`);
    } finally {
      setSavingProjectEdit(false);
    }
  };

  // Project Delete Handler
  const handleConfirmDeleteProject = async () => {
    setDeletingProject(true);
    try {
      await api.projects.delete(project.id);
      dispatch(deleteProject(project.id));
      setIsDeleteProjectOpen(false);
      if (onProjectDeleted) onProjectDeleted(project.id);
    } catch (err) {
      alert(`Failed to delete project: ${err.message}`);
    } finally {
      setDeletingProject(false);
    }
  };

  // Child Application Edit Handlers
  const handleStartEditApp = (app) => {
    setEditingApp(app);
    setEditAppName(app.name);
    setEditAppDesc(app.description || '');
    setEditAppRepoUrl(app.repo_url || '');
  };

  const handleSaveAppEdit = async (e) => {
    e.preventDefault();
    if (!editAppName.trim() || !editingApp) return;

    setSavingAppEdit(true);
    try {
      const updated = await api.applications.update(editingApp.id, {
        name: editAppName.trim(),
        description: editAppDesc.trim(),
        repo_url: editAppRepoUrl.trim()
      });
      dispatch(updateApplicationInState(updated));
      setEditingApp(null);
      if (onProjectUpdated) onProjectUpdated();
    } catch (err) {
      alert(`Failed to update application: ${err.message}`);
    } finally {
      setSavingAppEdit(false);
    }
  };

  // Child Application Delete Handler
  const handleDeleteChildApp = (app) => {
    setAppToDelete(app);
  };

  const handleConfirmDeleteChildApp = async () => {
    if (!appToDelete) return;
    setDeletingChildApp(true);
    try {
      await api.applications.delete(appToDelete.id);
      dispatch(deleteApplicationFromState(appToDelete.id));
      setAppToDelete(null);
      if (onProjectUpdated) onProjectUpdated();
    } catch (err) {
      alert(`Failed to delete application: ${err.message}`);
    } finally {
      setDeletingChildApp(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Project Hero Header */}
      <div className="neo-card-static" style={{ padding: '24px', background: 'var(--neo-white)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'var(--neo-yellow)',
              border: 'var(--neo-border-4)',
              boxShadow: 'var(--neo-shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <FolderKanban size={30} color="#000" strokeWidth={3} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
                  {project.name}
                </h1>
              </div>

              {project.description && (
                <p style={{ fontSize: '0.92rem', color: 'var(--neo-black)', opacity: 0.8, fontWeight: 600, marginTop: '6px', maxWidth: '850px' }}>
                  {project.description}
                </p>
              )}
            </div>
          </div>

          {/* Hero Actions: Edit Project, Delete Project, Register App */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              id="btn-edit-project"
              onClick={handleOpenEditProject}
              className="btn-neo-secondary"
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
              title="Edit Project"
            >
              <Edit2 size={15} strokeWidth={2.5} />
              <span>Edit Project</span>
            </button>

            <button
              id="btn-delete-project"
              onClick={() => setIsDeleteProjectOpen(true)}
              className="btn-neo-danger"
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
              title="Delete Project"
            >
              <Trash2 size={15} strokeWidth={2.5} />
              <span>Delete</span>
            </button>

            <button
              id="btn-register-app"
              onClick={onOpenNewApplication}
              className="btn-neo-cyan"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Plus size={16} strokeWidth={3} />
              <span>Register Application</span>
            </button>
          </div>
        </div>
      </div>

      {/* Project Sub-Tabs Bar */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: 'var(--neo-border-4)', paddingBottom: '0px', overflowX: 'auto' }}>
        {subTabs.map(tab => {
          const isActive = activeSubTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              id={`proj-tab-${tab.id}`}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                fontSize: '0.88rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                background: isActive ? 'var(--neo-yellow)' : 'var(--neo-surface-1)',
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
        {/* Tab 1: Applications List under this project */}
        {activeSubTab === 'apps' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {applications.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                {applications.map(app => (
                  <div key={app.id} className="neo-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '230px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ background: 'var(--neo-cyan)', border: '2px solid #000', padding: '5px', display: 'flex' }}>
                            <Cpu size={18} color="#000" strokeWidth={3} />
                          </div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase' }}>
                            {app.name}
                          </h3>
                        </div>
                        <span className="neo-badge neo-badge-green" style={{ fontSize: '0.66rem' }}>
                          ACTIVE
                        </span>
                      </div>

                      {app.description && (
                        <p style={{ fontSize: '0.84rem', color: 'var(--neo-black)', opacity: 0.8, fontWeight: 600, lineHeight: 1.4, marginBottom: '14px' }}>
                          {app.description}
                        </p>
                      )}

                      {app.repo_url && (
                        <div style={{ marginBottom: '12px' }}>
                          <a
                            href={app.repo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: 'var(--neo-cyan)',
                              textDecoration: 'underline'
                            }}
                          >
                            <GitBranch size={12} />
                            <span>{app.repo_url}</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Application Card Actions: Edit, Delete, Details */}
                    <div style={{
                      paddingTop: '14px',
                      borderTop: 'var(--neo-border-4)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleStartEditApp(app)}
                          className="btn-neo-outline"
                          style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          title="Edit Application"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteChildApp(app)}
                          className="btn-neo-danger"
                          style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          title="Delete Application"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleOpenApp(app.id)}
                        className="btn-neo-primary"
                        style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                      >
                        <span>Details</span>
                        <ArrowRight size={14} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="neo-card-yellow" style={{ padding: '40px', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '8px' }}>
                  NO APPLICATIONS REGISTERED IN THIS PROJECT
                </h3>
                <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '16px' }}>
                  Register applications and microservices to manage their secrets, probes, and files.
                </p>
                <button onClick={onOpenNewApplication} className="btn-neo-primary">
                  <Plus size={15} strokeWidth={3} />
                  <span>Register First Application</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Project Shared Secrets */}
        {activeSubTab === 'secrets' && (
          <ConfigsManager
            projects={projects}
            activeProjectId={project.id}
            activeApplicationId={null}
            sensitiveClipboard={sensitiveClipboard}
            hideHeader={true}
          />
        )}

        {/* Tab 3: Project Resource Links */}
        {activeSubTab === 'links' && (
          <LinksHub
            activeProjectId={project.id}
            hideHeader={true}
            customTitle={`${project.name} Links`}
          />
        )}

        {/* Tab 4: Project Files */}
        {activeSubTab === 'files' && (
          <ProjectFilesManager
            activeProjectId={project.id}
          />
        )}
      </div>

      {/* Edit Project Modal */}
      {isEditProjectOpen && (
        <div className="neo-modal-overlay" onClick={() => setIsEditProjectOpen(false)}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="neo-modal-header neo-modal-header-yellow" style={{
              padding: '18px 24px',
              background: 'var(--neo-yellow)',
              color: '#000000',
              borderBottom: 'var(--neo-border-4)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', margin: 0 }}>
                Edit Project Details
              </h3>
              <button onClick={() => setIsEditProjectOpen(false)} className="btn-neo-outline" style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProjectEdit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Project Name
                </label>
                <input
                  id="input-edit-project-name"
                  type="text"
                  required
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="neo-input"
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Description / Purpose
                </label>
                <textarea
                  id="input-edit-project-desc"
                  value={editProjectDesc}
                  onChange={(e) => setEditProjectDesc(e.target.value)}
                  className="neo-input"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsEditProjectOpen(false)} className="btn-neo-outline">
                  Cancel
                </button>
                <button type="submit" disabled={savingProjectEdit} className="btn-neo-primary">
                  {savingProjectEdit ? 'Saving...' : 'Update Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {isDeleteProjectOpen && (
        <div className="neo-modal-overlay" onClick={() => setIsDeleteProjectOpen(false)}>
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
                Delete Project
              </h3>
              <button onClick={() => setIsDeleteProjectOpen(false)} className="btn-neo-outline" style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <p style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '14px', lineHeight: 1.5 }}>
                Are you sure you want to delete <span style={{ textDecoration: 'underline' }}>{project.name}</span>?
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
                  <strong>CRITICAL WARNING:</strong> This will permanently delete this project, along with all {applications.length} application(s), secrets, health checks, links, and uploaded files.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsDeleteProjectOpen(false)} className="btn-neo-outline">
                  Cancel
                </button>
                <button
                  id="btn-confirm-delete-project"
                  type="button"
                  onClick={handleConfirmDeleteProject}
                  disabled={deletingProject}
                  className="btn-neo-danger"
                >
                  {deletingProject ? 'Deleting...' : 'Yes, Delete Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Child Application Modal */}
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
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', margin: 0 }}>
                  Edit Application Details
                </h3>
              </div>
              <button onClick={() => setEditingApp(null)} className="btn-neo-outline" style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAppEdit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Application Name
                </label>
                <input
                  type="text"
                  required
                  value={editAppName}
                  onChange={(e) => setEditAppName(e.target.value)}
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
                  value={editAppDesc}
                  onChange={(e) => setEditAppDesc(e.target.value)}
                  className="neo-input"
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Git Repository URL
                </label>
                <input
                  type="url"
                  value={editAppRepoUrl}
                  onChange={(e) => setEditAppRepoUrl(e.target.value)}
                  className="neo-input font-mono"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setEditingApp(null)} className="btn-neo-outline">
                  Cancel
                </button>
                <button type="submit" disabled={savingAppEdit} className="btn-neo-primary">
                  {savingAppEdit ? 'Saving...' : 'Update Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Child Application Confirmation Modal */}
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
                  id="btn-confirm-delete-child-app"
                  type="button"
                  onClick={handleConfirmDeleteChildApp}
                  disabled={deletingChildApp}
                  className="btn-neo-danger"
                >
                  {deletingChildApp ? 'Deleting...' : 'Yes, Delete Application'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
