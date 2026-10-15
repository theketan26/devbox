import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/authSlice.js';
import { setActiveProject, setActiveApplication } from '../store/projectsSlice.js';
import {
  Layers,
  LayoutDashboard,
  Cpu,
  Activity,
  BarChart3,
  Clock,
  FolderKanban,
  Plus,
  ShieldCheck,
  LogOut,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  onOpenNewApplication,
  onOpenNewProject
}) {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { projects, activeProjectId, activeApplicationId } = useSelector(state => state.projects);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const applications = Array.isArray(activeProject?.applications) ? activeProject.applications : [];

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'projects', label: 'Project', icon: FolderKanban },
    { id: 'applications', label: 'Applications', icon: Cpu },
    { id: 'health', label: 'Health Probes', icon: Activity },
  ];

  return (
    <aside style={{
      width: '280px',
      minWidth: '280px',
      background: 'var(--neo-canvas)',
      borderRight: 'var(--neo-border-4)',
      boxShadow: '4px 0px 0px 0px #090A0D',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      userSelect: 'none'
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '20px',
        borderBottom: 'var(--neo-border-4)',
        background: 'var(--neo-surface-1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          background: 'var(--neo-red)',
          border: 'var(--neo-border-4)',
          boxShadow: 'var(--neo-shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Layers size={24} color="#000" strokeWidth={3} />
        </div>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1.35rem', letterSpacing: '-0.04em', lineHeight: 1 }}>
            DEV BOX
          </div>
          {/* <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--neo-green)' }} />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--neo-cyan)', letterSpacing: '0.04em' }}>
              SUPABASE DB ACTIVE
            </span>
          </div> */}
        </div>
      </div>

      {/* Scope / Context Switchers */}
      <div style={{
        padding: '16px 18px',
        borderBottom: 'var(--neo-border-4)',
        background: 'var(--neo-surface-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--neo-black)', opacity: 0.7 }}>
            Workload Context
          </div>
          <button
            onClick={onOpenNewProject}
            className="btn-neo-project"
            style={{ padding: '2px 8px', fontSize: '0.74rem', fontWeight: 900 }}
            title="Create New Project"
          >
            + NEW
          </button>
        </div>

        {/* Project Selector */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px', color: 'var(--neo-yellow)' }}>
            <FolderKanban size={13} strokeWidth={3} color="var(--neo-yellow)" />
            <span>Active Project</span>
          </label>
          <select
            id="select-sidebar-project"
            value={activeProjectId || ''}
            onChange={(e) => dispatch(setActiveProject(e.target.value))}
            className="neo-input font-mono"
            style={{ padding: '6px 8px', fontSize: '0.8rem', width: '100%', borderColor: 'var(--neo-yellow)' }}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Links (Scrollable area) */}
      <nav style={{
        flex: 1,
        padding: '16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        overflowY: 'auto'
      }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 6px 4px', color: 'var(--neo-black)', opacity: 0.6 }}>
          Navigation Menu
        </div>

        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          // Domain color matching: projects -> yellow, applications -> blue, health -> green
          let activeBg = 'var(--neo-surface-3)';
          let activeBorder = 'var(--neo-border-color)';
          let activeColor = '#000000';

          if (item.id === 'projects') {
            activeBg = 'var(--neo-yellow)';
            activeBorder = 'var(--neo-yellow)';
          } else if (item.id === 'applications') {
            activeBg = 'var(--neo-cyan)';
            activeBorder = 'var(--neo-cyan)';
          } else if (item.id === 'health') {
            activeBg = 'var(--neo-green)';
            activeBorder = 'var(--neo-green)';
          } else if (item.id === 'dashboard') {
            activeBg = 'var(--neo-surface-3)';
            activeBorder = 'var(--neo-cyan)';
            activeColor = 'var(--neo-black)';
          }

          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 14px',
                background: isActive ? activeBg : 'var(--neo-surface-1)',
                color: isActive ? activeColor : 'var(--neo-black)',
                border: isActive ? `3px solid ${activeBorder}` : 'var(--neo-border-2)',
                boxShadow: isActive ? 'var(--neo-shadow-sm)' : 'none',
                transform: isActive ? 'translate(-2px, -2px)' : 'none',
                cursor: 'pointer',
                fontFamily: 'var(--neo-font)',
                fontSize: '0.88rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                textAlign: 'left',
                width: '100%',
                transition: 'all 120ms ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={18} strokeWidth={isActive ? 3 : 2.5} />
                <span>{item.label}</span>
              </div>
              {isActive && (
                <ChevronRight size={16} strokeWidth={3} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div style={{
        padding: '16px',
        borderTop: 'var(--neo-border-4)',
        background: 'var(--neo-surface-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* User Badge */}
        {/* <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', background: 'var(--neo-green)', border: '2px solid #000' }} />
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 900, lineHeight: 1 }}>
                {user?.username || 'master_admin'}
              </div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#000', opacity: 0.75, marginTop: '2px' }}>
                {user?.role || 'Administrator'}
              </div>
            </div>
          </div>

          <div className="neo-badge neo-badge-green" style={{ fontSize: '0.66rem', padding: '2px 6px' }}>
            <ShieldCheck size={12} strokeWidth={3} />
            <span>2FA</span>
          </div>
        </div> */}

        {/* Logout Button */}
        <button
          id="btn-sidebar-logout"
          onClick={() => dispatch(logout())}
          className="btn-neo-danger"
          style={{ width: '100%', padding: '9px', fontSize: '0.82rem' }}
        >
          <LogOut size={15} strokeWidth={3} />
          <span>SIGN OUT</span>
        </button>
      </div>
    </aside>
  );
}
