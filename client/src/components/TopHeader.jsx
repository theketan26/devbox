import React from 'react';
import { useSelector } from 'react-redux';
import {
  ClipboardCheck,
  FolderKanban,
  Cpu,
  Key,
  MessageSquare,
  ShieldAlert,
  Activity,
  Layers
} from 'lucide-react';

export default function TopHeader({
  sensitiveClipboard,
  onOpenImport,
  onOpenWhatsAppTest,
  activeTab
}) {
  const { projects, activeProjectId, activeApplicationId } = useSelector(state => state.projects);
  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeApp = activeProject?.applications?.find(a => a.id === activeApplicationId);

  const getTabTitle = (tab) => {
    switch (tab) {
      case 'dashboard': return 'Mission Control Overview';
      case 'projects': return 'Project Hierarchy & Workloads';
      case 'applications': return 'Applications & Microservices Registry';
      case 'health': return 'Synthetic Health Check Probes';
      default: return 'Developer Operations Hub';
    }
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 30,
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

      {/* Top Context & Actions Bar */}
      <div style={{
        padding: '12px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'var(--neo-white)'
      }}>
        {/* Breadcrumb Context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
            {getTabTitle(activeTab)}
          </span>

          <div style={{ height: '16px', width: '2px', background: '#000' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="neo-badge neo-badge-yellow" style={{ fontSize: '0.7rem' }}>
              <FolderKanban size={12} strokeWidth={3} />
              <span>{activeProject?.name || 'All Projects'}</span>
            </span>

            {activeApp && (
              <span className="neo-badge neo-badge-violet" style={{ fontSize: '0.7rem' }}>
                <Cpu size={12} strokeWidth={3} />
                <span>{activeApp.name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Quick Actions Shortcuts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            id="btn-topbar-whatsapp"
            onClick={onOpenWhatsAppTest}
            className="btn-neo-outline"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            title="Configure and test WhatsApp alerts bridge"
          >
            <MessageSquare size={14} strokeWidth={3} />
            <span>WhatsApp Bridge</span>
          </button>

          <button
            id="btn-topbar-import-env"
            onClick={onOpenImport}
            className="btn-neo-primary"
            style={{ padding: '6px 14px', fontSize: '0.78rem' }}
          >
            <Key size={14} strokeWidth={3} />
            <span>Import .env</span>
          </button>
        </div>
      </div>
    </header>
  );
}
