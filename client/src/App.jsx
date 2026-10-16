import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { api } from './services/api.js';
import { setProjects, setActiveApplication } from './store/projectsSlice.js';
import { loginSuccess } from './store/authSlice.js';
import { useSensitiveClipboard } from './hooks/useSensitiveClipboard.js';

import Sidebar from './components/Sidebar.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import DashboardOverview from './components/DashboardOverview.jsx';
import HealthCheckMonitor from './components/HealthCheckMonitor.jsx';
import WhatsAppSettingsModal from './components/WhatsAppSettingsModal.jsx';
import NewProjectModal from './components/NewProjectModal.jsx';
import ImportEnvModal from './components/ImportEnvModal.jsx';
import ApplicationsManager from './components/ApplicationsManager.jsx';
import NewApplicationModal from './components/NewApplicationModal.jsx';
import ProjectDetailPage from './components/ProjectDetailPage.jsx';

export default function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, refreshToken } = useSelector(state => state.auth);
  const { projects, activeProjectId, activeApplicationId } = useSelector(state => state.projects);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isNewAppModalOpen, setIsNewAppModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Sensitive Clipboard 45-second Auto-Clear Hook
  const sensitiveClipboard = useSensitiveClipboard(45);

  // Restore session if refresh token exists
  useEffect(() => {
    if (!isAuthenticated && refreshToken) {
      api.auth.refresh(refreshToken)
        .then(res => {
          dispatch(loginSuccess({
            accessToken: res.accessToken,
            refreshToken,
            user: { username: 'master_admin', role: 'Administrator', twoFactorVerified: true }
          }));
        })
        .catch(() => {
          // Token invalid, user will log in via LoginScreen
        });
    }
  }, [isAuthenticated, refreshToken]);

  // Load projects list
  const loadProjects = async () => {
    try {
      const res = await api.projects.list();
      dispatch(setProjects(res));
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
      const interval = setInterval(loadProjects, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const activeProject = projects.find(p => p.id === activeProjectId);
  const applications = Array.isArray(activeProject?.applications) ? activeProject.applications : [];

  return (
    <div className="neo-grid-bg" style={{ minHeight: '100vh', display: 'flex', position: 'relative' }}>
      {/* Left-Hand Side Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewApplication={() => setIsNewAppModalOpen(true)}
        onOpenNewProject={() => setIsNewProjectModalOpen(true)}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        {/* Body Content Container */}
        <main style={{ flex: 1, maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px 28px 60px' }}>
          {activeTab === 'dashboard' && (
            <DashboardOverview
              setActiveTab={setActiveTab}
              onOpenImport={() => setIsImportModalOpen(true)}
              onOpenWhatsAppTest={() => setIsWhatsAppModalOpen(true)}
              onOpenNewProject={() => setIsNewProjectModalOpen(true)}
              onOpenNewApplication={() => setIsNewAppModalOpen(true)}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectDetailPage
              project={activeProject}
              projects={projects}
              onOpenNewApplication={() => setIsNewAppModalOpen(true)}
              onSelectApplication={(appId) => {
                dispatch(setActiveApplication(appId));
                setActiveTab('applications');
              }}
              sensitiveClipboard={sensitiveClipboard}
              onProjectUpdated={loadProjects}
              onProjectDeleted={loadProjects}
            />
          )}

          {activeTab === 'applications' && (
            <ApplicationsManager
              projects={projects}
              activeProjectId={activeProjectId}
              activeApplicationId={activeApplicationId}
              setActiveTab={setActiveTab}
              onOpenNewApplication={() => setIsNewAppModalOpen(true)}
              sensitiveClipboard={sensitiveClipboard}
            />
          )}

          {activeTab === 'health' && (
            <HealthCheckMonitor
              activeApplicationId={activeApplicationId}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {isWhatsAppModalOpen && (
        <WhatsAppSettingsModal onClose={() => setIsWhatsAppModalOpen(false)} />
      )}

      {isNewProjectModalOpen && (
        <NewProjectModal onClose={() => setIsNewProjectModalOpen(false)} />
      )}

      {isNewAppModalOpen && (
        <NewApplicationModal
          projects={projects}
          activeProjectId={activeProjectId}
          onClose={() => setIsNewAppModalOpen(false)}
          onCreated={loadProjects}
        />
      )}

      {isImportModalOpen && (
        <ImportEnvModal
          projects={projects}
          activeProjectId={activeProjectId}
          activeApplicationId={activeApplicationId}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={loadProjects}
        />
      )}
    </div>
  );
}
