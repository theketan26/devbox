import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import {
  FolderKanban,
  Cpu,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MessageSquare,
  ArrowUpRight,
  RefreshCw,
  Clock,
  ShieldAlert,
  Send,
  Zap
} from 'lucide-react';

export default function DashboardOverview({ setActiveTab, onOpenImport, onOpenWhatsAppTest, onOpenNewProject, onOpenNewApplication }) {
  const [stats, setStats] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, waRes] = await Promise.allSettled([
        api.dashboard.getStats(),
        api.whatsapp.getStatus()
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      }
      if (waRes.status === 'fulfilled') {
        setWhatsappStatus(waRes.value);
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Banner & Quick Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.05 }}>
            DEVELOPER OPERATIONS HUB
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            id="btn-quick-new-project"
            onClick={onOpenNewProject}
            className="btn-neo-outline"
          >
            <FolderKanban size={16} strokeWidth={3} />
            <span>New Project</span>
          </button>

          <button
            id="btn-quick-new-app"
            onClick={onOpenNewApplication}
            className="btn-neo-secondary"
          >
            <Cpu size={16} strokeWidth={3} />
            <span>New Application</span>
          </button>

          <button
            id="btn-quick-import-env"
            onClick={onOpenImport}
            className="btn-neo-primary"
          >
            <ArrowUpRight size={16} strokeWidth={3} />
            <span>Import .env</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Tiles: Projects, Applications, Health Probes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>

        {/* Projects Tile (Yellowish) */}
        <div className="neo-card-yellow" onClick={() => setActiveTab('projects')} style={{ cursor: 'pointer', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Projects
            </div>
            <div style={{ padding: '8px', background: 'var(--neo-yellow)', color: '#000', border: '2px solid #000' }}>
              <FolderKanban size={22} strokeWidth={3} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '14px 0 6px 0' }}>
            <span style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1 }}>
              {stats?.totalProjects ?? '–'}
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 900, opacity: 0.6 }}>TOTAL</span>
          </div>
          <div style={{ marginTop: '12px', borderTop: '2px solid rgba(255,255,255,0.12)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>HEALTHY</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--neo-green)' }}>
              {stats?.healthyProjects ?? '–'} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'inherit', opacity: 0.7 }}>/ {stats?.totalProjects ?? '–'}</span>
            </span>
          </div>
        </div>

        {/* Applications Tile (Bluish) */}
        <div className="neo-card-cyan" onClick={() => setActiveTab('applications')} style={{ cursor: 'pointer', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Applications
            </div>
            <div style={{ padding: '8px', background: 'var(--neo-cyan)', color: '#000', border: '2px solid #000' }}>
              <Cpu size={22} strokeWidth={3} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '14px 0 6px 0' }}>
            <span style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1 }}>
              {stats?.totalApplications ?? '–'}
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 900, opacity: 0.6 }}>TOTAL</span>
          </div>
          <div style={{ marginTop: '12px', borderTop: '2px solid rgba(255,255,255,0.12)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>HEALTHY</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--neo-green)' }}>
              {stats?.healthyApplications ?? '–'} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'inherit', opacity: 0.7 }}>/ {stats?.totalApplications ?? '–'}</span>
            </span>
          </div>
        </div>

        {/* Health Probes Tile (Greenish) */}
        <div className="neo-card-green" onClick={() => setActiveTab('health')} style={{ cursor: 'pointer', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Health Probes
            </div>
            <div style={{ padding: '8px', background: 'var(--neo-green)', color: '#000', border: '2px solid #000' }}>
              <Activity size={22} strokeWidth={3} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '14px 0 6px 0' }}>
            <span style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1 }}>
              {stats?.totalHealthChecks ?? '–'}
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 900, opacity: 0.6 }}>TOTAL</span>
          </div>
          <div style={{ marginTop: '12px', borderTop: '2px solid rgba(255,255,255,0.12)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>HEALTHY</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--neo-green)' }}>
              {stats?.health?.healthy ?? '–'} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'inherit', opacity: 0.7 }}>/ {stats?.totalHealthChecks ?? '–'}</span>
            </span>
          </div>
        </div>

      </div>

      {/* Recent Probing Logs Table */}
      <div className="neo-card-static">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={22} strokeWidth={3} />
            <h3 style={{ fontSize: '1.2rem' }}>Recent Health Probes</h3>
          </div>
          <button
            onClick={fetchDashboardData}
            className="btn-neo-outline"
            style={{ padding: '5px 12px', fontSize: '0.78rem' }}
          >
            <RefreshCw size={13} strokeWidth={3} />
            <span>Refresh</span>
          </button>
        </div>

        {stats?.recentLogs && stats.recentLogs.length > 0 ? (
          <div style={{ overflowX: 'auto', border: 'var(--neo-border-4)' }}>
            <table className="neo-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Result</th>
                  <th style={{ textAlign: 'left' }}>HTTP Code</th>
                  <th style={{ textAlign: 'left' }}>Latency</th>
                  <th style={{ textAlign: 'left' }}>Timestamp</th>
                  <th style={{ textAlign: 'left' }}>Diagnostic Summary</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLogs.map(log => (
                  <tr key={log.id}>
                    <td>
                      {log.is_success ? (
                        <span className="neo-badge neo-badge-green" style={{ fontSize: '0.7rem' }}>
                          <CheckCircle size={13} strokeWidth={3} /> PASS
                        </span>
                      ) : (
                        <span className="neo-badge neo-badge-red" style={{ fontSize: '0.7rem' }}>
                          <XCircle size={13} strokeWidth={3} /> FAIL
                        </span>
                      )}
                    </td>
                    <td className="font-mono" style={{ fontWeight: 900 }}>
                      HTTP {log.status_code || 'ERR'}
                    </td>
                    <td className="font-mono" style={{ fontWeight: 900 }}>
                      {log.response_time_ms} ms
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.82rem' }}>
                      {new Date(log.checked_at).toLocaleTimeString()}
                    </td>
                    <td style={{ fontSize: '0.84rem' }}>
                      {log.error_message || 'Endpoint answered with expected status code.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', fontWeight: 900 }}>
            NO RECENT PROBE LOGS RECORDED.
          </div>
        )}
      </div>
    </div>
  );
}
