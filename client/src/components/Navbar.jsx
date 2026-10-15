import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/authSlice.js';
import { setActiveProject, setActiveApplication } from '../store/projectsSlice.js';
import {
  ShieldCheck,
  LogOut,
  FolderKanban,
  Cpu,
  Layers,
  ClipboardCheck,
  AlertTriangle
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, sensitiveClipboard, onOpenNewApplication }) {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { projects, activeProjectId, activeApplicationId } = useSelector(state => state.projects);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const applications = Array.isArray(activeProject?.applications) ? activeProject.applications : [];

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'var(--neo-canvas)',
      borderBottom: 'var(--neo-border-4)',
      boxShadow: '0 4px 0px 0px #000000'
    }}>
      {/* Sensitive Clipboard Auto-Clear Alert Bar */}
      {sensitiveClipboard.copiedKey && sensitiveClipboard.secondsLeft > 0 && (
        <div style={{
          background: 'var(--neo-yellow)',
          color: '#000000',
          borderBottom: 'var(--neo-border-4)',
          padding: '8px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.86rem',
          fontWeight: 900
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardCheck size={18} strokeWidth={3} />
            <span>
              SECRET <span className="font-mono" style={{ background: '#000', color: 'var(--neo-black)', padding: '2px 6px' }}>{sensitiveClipboard.copiedKey}</span> COPIED!
              AUTO-CLEARING OS CLIPBOARD IN <span style={{ color: 'var(--neo-red)', textDecoration: 'underline' }}>{sensitiveClipboard.secondsLeft}S</span>.
            </span>
          </div>
          <button
            id="btn-clear-clipboard-now"
            onClick={sensitiveClipboard.clearNow}
            className="btn-neo-danger"
            style={{ padding: '4px 10px', fontSize: '0.74rem' }}
          >
            Clear Now
          </button>
        </div>
      )}

      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        {/* Brand & Project Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            onClick={() => setActiveTab('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          >
            <div style={{
              width: '42px',
              height: '42px',
              background: 'var(--neo-red)',
              border: 'var(--neo-border-4)',
              boxShadow: 'var(--neo-shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={22} color="#000" strokeWidth={3} />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.25rem', letterSpacing: '-0.04em', lineHeight: 1 }}>
                DEV BOX
              </div>
              <div style={{
                fontSize: '0.66rem',
                background: 'var(--neo-yellow)',
                color: '#000000',
                border: '1px solid #000',
                padding: '1px 5px',
                display: 'inline-block',
                marginTop: '3px',
                fontWeight: 900
              }}>
                OPERATIONS & SECRETS
              </div>
            </div>
          </div>

          <div style={{ height: '32px', width: '3px', background: '#000000' }} />

          {/* Project & App Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderKanban size={16} strokeWidth={3} />
              <select
                id="select-active-project"
                value={activeProjectId || ''}
                onChange={(e) => dispatch(setActiveProject(e.target.value))}
                className="neo-input font-mono"
                style={{ padding: '6px 10px', fontSize: '0.82rem', width: 'auto', minWidth: '180px' }}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={16} strokeWidth={3} />
              <select
                id="select-active-application"
                value={activeApplicationId || ''}
                onChange={(e) => dispatch(setActiveApplication(e.target.value || null))}
                className="neo-input font-mono"
                style={{ padding: '6px 10px', fontSize: '0.82rem', width: 'auto', minWidth: '160px' }}
              >
                <option value="">ALL APPLICATIONS</option>
                {applications.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button
                id="btn-navbar-add-app"
                onClick={onOpenNewApplication}
                className="btn-neo-secondary"
                style={{ padding: '6px 8px', fontSize: '0.76rem' }}
                title="Register New Application"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {[
            { id: 'dashboard', label: 'Overview' },
            { id: 'applications', label: 'Applications' },
            { id: 'configs', label: 'Secrets & Parity' },
            { id: 'health', label: 'Health' },
            { id: 'telemetry', label: 'Telemetry' },
            { id: 'expirations', label: 'Expirations' },
            { id: 'links', label: 'Links' },
            { id: 'files', label: 'Files' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '7px 12px',
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  background: isActive ? 'var(--neo-yellow)' : 'var(--neo-white)',
                  color: '#000000',
                  border: 'var(--neo-border-2)',
                  boxShadow: isActive ? '3px 3px 0px 0px #000' : 'none',
                  transform: isActive ? 'translate(-1px, -1px)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 100ms ease'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* User Badge & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="neo-badge neo-badge-green" style={{ fontSize: '0.7rem' }}>
            <ShieldCheck size={14} strokeWidth={3} />
            <span>2FA SECURED</span>
          </div>

          <button
            id="btn-user-logout"
            onClick={() => dispatch(logout())}
            className="btn-neo-danger"
            title="Sign out of Dev Box"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
          >
            <LogOut size={14} strokeWidth={3} />
            <span>EXIT</span>
          </button>
        </div>
      </div>
    </header>
  );
}
