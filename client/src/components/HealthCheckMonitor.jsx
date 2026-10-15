import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import {
  Activity,
  Plus,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Trash2,
  SlidersHorizontal,
  Wrench,
  Zap,
  Database,
  Code,
  ChevronDown,
  ChevronUp,
  Terminal,
  Cpu,
  History,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function HealthCheckMonitor({ activeApplicationId }) {
  const [checks, setChecks] = useState([]);
  const [pgCrons, setPgCrons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pingingId, setPingingId] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPgCronRegistryOpen, setIsPgCronRegistryOpen] = useState(false);
  const [expandedSqlId, setExpandedSqlId] = useState(null);
  const [syncingCrons, setSyncingCrons] = useState(false);

  // History modal state
  const [historyCheck, setHistoryCheck] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);

  // Form state
  const [name, setName] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [expectedJsonStr, setExpectedJsonStr] = useState('');
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchChecks = async () => {
    setLoading(true);
    try {
      const [checksRes, cronsRes] = await Promise.allSettled([
        api.healthChecks.list(activeApplicationId || undefined),
        api.healthChecks.listPgCrons()
      ]);

      if (checksRes.status === 'fulfilled') {
        setChecks(checksRes.value);
      }
      if (cronsRes.status === 'fulfilled') {
        setPgCrons(cronsRes.value.jobs || []);
      }
    } catch (err) {
      console.error('Failed to load health checks & pg_crons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecks();
    const interval = setInterval(fetchChecks, 10000);
    return () => clearInterval(interval);
  }, [activeApplicationId]);

  const handleSyncPgCrons = async () => {
    setSyncingCrons(true);
    try {
      const res = await api.healthChecks.syncPgCrons();
      setPgCrons(res.jobs || []);
      await fetchChecks();
    } catch (err) {
      alert(`Supabase pg_cron sync failed: ${err.message}`);
    } finally {
      setSyncingCrons(false);
    }
  };

  const handleOpenHistory = async (checkId, fallbackName = 'Health Check') => {
    if (!checkId) {
      alert('No linked health check found for this job.');
      return;
    }
    const checkObj = checks.find(c => c.id === checkId) || { id: checkId, name: fallbackName };
    setHistoryCheck(checkObj);
    setHistoryLogs(checkObj.recentLogs || []);
    setHistoryPage(1);
    setLoadingHistory(true);

    try {
      const data = await api.healthChecks.get(checkId);
      setHistoryCheck(data);
      setHistoryLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to load health check history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCloseHistory = () => {
    setHistoryCheck(null);
    setHistoryLogs([]);
    setHistoryPage(1);
  };

  const handlePing = async (id) => {
    setPingingId(id);
    try {
      await api.healthChecks.ping(id);
      fetchChecks(true);
      if (historyCheck && historyCheck.id === id) {
        const data = await api.healthChecks.get(id);
        setHistoryCheck(data);
        setHistoryLogs(data.logs || []);
      }
    } catch (err) {
      alert(`Ping failed: ${err.message}`);
    } finally {
      setPingingId(null);
    }
  };

  const handleToggleMaintenance = async (check) => {
    try {
      await api.healthChecks.update(check.id, {
        is_maintenance_mode: !check.is_maintenance_mode
      });
      fetchChecks();
    } catch (err) {
      alert(`Failed to toggle maintenance mode: ${err.message}`);
    }
  };

  const handleDelete = async (id, checkName) => {
    if (!window.confirm(`Delete health check ${checkName} and unschedule its Supabase pg_cron job?`)) return;
    try {
      await api.healthChecks.delete(id);
      setChecks(prev => prev.filter(c => c.id !== id));
      setPgCrons(prev => prev.filter(j => j.health_check_id !== id));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name || !endpointUrl) return;

    let parsedJson = null;
    if (expectedJsonStr.trim()) {
      try {
        parsedJson = JSON.parse(expectedJsonStr);
      } catch {
        alert('Invalid JSON in Expected JSON Payload');
        return;
      }
    }

    setSaving(true);
    try {
      const appId = activeApplicationId || (checks[0]?.application_id || 'default');
      await api.healthChecks.create({
        application_id: appId,
        name,
        endpoint_url: endpointUrl,
        method,
        interval_minutes: Number(intervalMinutes),
        timeout_ms: Number(timeoutMs),
        expected_status: Number(expectedStatus),
        expected_json_payload: parsedJson,
        is_maintenance_mode: isMaintenance
      });
      setName('');
      setEndpointUrl('');
      setExpectedJsonStr('');
      setIsAddOpen(false);
      fetchChecks();
    } catch (err) {
      alert(`Failed to create health check: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Cron expression helper for modal preview
  const previewCronExpr = Number(intervalMinutes) === 1 ? '* * * * *' : `*/${Number(intervalMinutes) || 5} * * * *`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900 }}>
            HEALTH PROBING & RECOVERY ENGINE
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsPgCronRegistryOpen(prev => !prev)}
            className={isPgCronRegistryOpen ? 'btn-neo-cyan' : 'btn-neo-outline'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Database size={15} strokeWidth={2.5} />
            <span>Supabase pg_cron ({pgCrons.length})</span>
            {isPgCronRegistryOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            onClick={handleSyncPgCrons}
            disabled={syncingCrons}
            className="btn-neo-outline"
            title="Sync all probes with Supabase pg_cron schedule registry"
          >
            <RefreshCw size={14} className={syncingCrons ? 'animate-spin' : ''} strokeWidth={3} />
            <span>{syncingCrons ? 'Syncing...' : 'Sync pg_cron'}</span>
          </button>

          <button
            onClick={fetchChecks}
            className="btn-neo-outline"
          >
            <RefreshCw size={14} strokeWidth={3} />
            <span>Poll Now</span>
          </button>

          <button
            id="btn-add-health-check"
            onClick={() => setIsAddOpen(true)}
            className="btn-neo-green"
          >
            <Plus size={16} strokeWidth={3} />
            <span>New Health Check</span>
          </button>
        </div>
      </div>

      {/* Supabase pg_cron Registry Section */}
      {isPgCronRegistryOpen && (
        <div className="neo-card-static" style={{ background: 'var(--neo-surface-1)', border: 'var(--neo-border-4)', boxShadow: 'var(--neo-shadow-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--neo-border-2)', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', background: 'var(--neo-cyan)', border: 'var(--neo-border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Terminal size={18} strokeWidth={3} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900 }}>SUPABASE POSTGRESQL pg_cron REGISTRY</h3>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="neo-badge neo-badge-green font-mono">
                {pgCrons.filter(j => j.active).length} ACTIVE
              </span>
              <span className="neo-badge neo-badge-violet font-mono">
                {pgCrons.filter(j => !j.active).length} PAUSED
              </span>
            </div>
          </div>

          {pgCrons.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontStyle: 'italic', opacity: 0.7 }}>
              No pg_cron jobs registered yet. Register a health check to schedule an automated probe.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--neo-surface-3)', borderBottom: 'var(--neo-border-2)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 900 }}>JOB ID</th>
                    <th style={{ padding: '10px 12px', fontWeight: 900 }}>JOB NAME</th>
                    <th style={{ padding: '10px 12px', fontWeight: 900 }}>CRON SCHEDULE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 900 }}>STATUS</th>
                    <th style={{ padding: '10px 12px', fontWeight: 900 }}>DATABASE NODE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 900 }}>NEXT EXECUTION</th>
                    <th style={{ padding: '10px 12px', fontWeight: 900 }}>COMMAND PREVIEW</th>
                    <th style={{ padding: '10px 12px', fontWeight: 900, textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {pgCrons.map(job => {
                    const matchedCheck = checks.find(c => c.id === job.health_check_id || c.name === job.health_check_name);
                    const targetCheckId = job.health_check_id || matchedCheck?.id;
                    const targetCheckName = job.health_check_name || matchedCheck?.name || job.jobname;

                    return (
                      <tr key={job.jobid} style={{ borderBottom: '1px solid var(--neo-border-color)' }}>
                        <td style={{ padding: '10px 12px' }} className="font-mono font-bold">
                          #{job.jobid}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                          {job.jobname}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <code className="font-mono font-bold" style={{ background: 'var(--neo-yellow)', color: '#000', padding: '2px 6px', border: '1px solid #000' }}>
                            {job.schedule}
                          </code>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className={`neo-badge ${job.active ? 'neo-badge-green' : 'neo-badge-violet'}`} style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                            {job.active ? 'ACTIVE' : 'PAUSED'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }} className="font-mono text-xs opacity-80">
                          {job.nodename || 'postgres'}
                        </td>
                        <td style={{ padding: '10px 12px' }} className="font-mono text-xs">
                          {job.next_run_at ? new Date(job.next_run_at).toLocaleTimeString() : 'In ' + (job.interval_minutes || 5) + 'm'}
                        </td>
                        <td style={{ padding: '10px 12px' }} className="font-mono text-xs opacity-75 max-w-xs truncate" title={job.command}>
                          {job.command ? job.command.slice(0, 45) + '...' : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleOpenHistory(targetCheckId, targetCheckName)}
                            className="btn-neo-outline"
                            style={{ padding: '4px 10px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            title="View health check call history and logs"
                          >
                            <History size={13} strokeWidth={2.5} />
                            <span>History</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Health Checks Cards Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {checks.map(check => {
          const isDown = check.current_status === 'down';
          const isMaintenanceActive = check.is_maintenance_mode;
          const pgCronData = check.pg_cron || pgCrons.find(j => j.health_check_id === check.id);
          const isExpandedSql = expandedSqlId === check.id;

          return (
            <div
              key={check.id}
              className="neo-card-static"
              style={{
                background: isDown
                  ? '#2A0808'
                  : isMaintenanceActive
                    ? '#1A1030'
                    : 'var(--neo-surface-2)',
                boxShadow: 'var(--neo-shadow-md)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <span className="neo-badge neo-badge-yellow font-mono" style={{ fontSize: '0.74rem' }}>
                      {check.method}
                    </span>
                    <h3 style={{ fontSize: '1.3rem', margin: 0 }}>{check.name}</h3>
                    <span className={`neo-badge ${isDown ? 'neo-badge-red' : isMaintenanceActive ? 'neo-badge-violet' : 'neo-badge-green'}`}>
                      {isMaintenanceActive ? 'MAINTENANCE' : check.current_status.toUpperCase()}
                    </span>

                    {/* Supabase pg_cron Status Badge */}
                    <span
                      className={`neo-badge ${pgCronData?.active ? 'neo-badge-cyan' : 'neo-badge-violet'} font-mono`}
                      style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      title="Managed pg_cron job in Supabase PostgreSQL"
                    >
                      <Database size={12} />
                      <span>PG_CRON #{pgCronData?.jobid || check.id.slice(0, 6)}: {pgCronData?.active ? 'ACTIVE' : 'PAUSED'}</span>
                    </span>
                  </div>

                  <div className="font-mono" style={{ fontSize: '0.88rem', fontWeight: 900, wordBreak: 'break-all', color: 'var(--neo-black)' }}>
                    {check.endpoint_url}
                  </div>
                </div>

                {/* Right Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Maintenance Toggle */}
                  <button
                    id={`btn-maintenance-${check.id}`}
                    onClick={() => handleToggleMaintenance(check)}
                    className={isMaintenanceActive ? 'btn-neo-violet' : 'btn-neo-outline'}
                    style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                    title={isMaintenanceActive ? 'Resume probe & pg_cron schedule' : 'Pause check & pg_cron for maintenance'}
                  >
                    <Wrench size={14} strokeWidth={3} />
                    <span>{isMaintenanceActive ? 'MAINTENANCE ON' : 'PAUSE CHECK'}</span>
                  </button>

                  {/* Immediate Ping */}
                  <button
                    id={`btn-ping-now-${check.id}`}
                    onClick={() => handlePing(check.id)}
                    disabled={pingingId === check.id || isMaintenanceActive}
                    className="btn-neo-green"
                    style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                  >
                    {pingingId === check.id ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" strokeWidth={3} />
                        <span>PINGING...</span>
                      </>
                    ) : (
                      <>
                        <Play size={14} strokeWidth={3} />
                        <span>PING NOW</span>
                      </>
                    )}
                  </button>

                  {/* History View Button */}
                  <button
                    id={`btn-history-${check.id}`}
                    onClick={() => handleOpenHistory(check.id, check.name)}
                    className="btn-neo-outline"
                    style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    title="View health check calls history & logs"
                  >
                    <History size={14} strokeWidth={2.5} />
                    <span>HISTORY</span>
                  </button>

                  <button
                    onClick={() => handleDelete(check.id, check.name)}
                    className="btn-neo-danger"
                    style={{ padding: '8px 10px' }}
                    title="Delete health check and pg_cron schedule"
                  >
                    <Trash2 size={14} strokeWidth={3} />
                  </button>
                </div>
              </div>

              {/* Status details bar with Supabase pg_cron metadata */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
                marginTop: '18px',
                paddingTop: '16px',
                borderTop: '2px solid var(--neo-border-color)'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.8 }}>LAST STATUS</div>
                  <div className="font-mono" style={{ fontSize: '1.05rem', fontWeight: 900, color: check.last_status_code === check.expected_status ? '#16A34A' : '#E11D48', marginTop: '2px' }}>
                    {check.last_status_code ? `HTTP ${check.last_status_code}` : 'PENDING'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.8 }}>RESPONSE LATENCY</div>
                  <div className="font-mono" style={{ fontSize: '1.05rem', fontWeight: 900, marginTop: '2px' }}>
                    {check.last_response_time_ms ? `${check.last_response_time_ms} MS` : '—'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.8 }}>CONSECUTIVE FAILS</div>
                  <div className="font-mono" style={{ fontSize: '1.05rem', fontWeight: 900, color: check.consecutive_failures > 0 ? '#E11D48' : 'var(--neo-black)', marginTop: '2px' }}>
                    {check.consecutive_failures} {check.consecutive_failures >= 2 ? '(ALERT DISPATCHED)' : ''}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.8 }}>UPTIME RATIO</div>
                  <div className="font-mono" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#2563EB', marginTop: '2px' }}>
                    {check.uptimePct ?? 100}%
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.8 }}>PG_CRON SCHEDULE</div>
                  <div className="font-mono font-bold" style={{ fontSize: '0.92rem', marginTop: '2px', color: 'var(--neo-cyan)' }}>
                    {pgCronData?.schedule || `*/${check.interval_minutes} * * * *`}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.8 }}>NEXT PG_CRON RUN</div>
                  <div className="font-mono" style={{ fontSize: '0.88rem', fontWeight: 800, marginTop: '2px' }}>
                    {pgCronData?.next_run_at ? new Date(pgCronData.next_run_at).toLocaleTimeString() : `In ${check.interval_minutes}m`}
                  </div>
                </div>
              </div>

              {/* JSON Payload expectation info */}
              {check.expected_json_payload && (
                <div style={{ marginTop: '14px', fontSize: '0.8rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>PAYLOAD ASSERTION:</span>
                  <code className="font-mono" style={{ background: 'var(--neo-yellow)', color: '#000', border: '2px solid #000', padding: '2px 8px' }}>
                    {JSON.stringify(check.expected_json_payload)}
                  </code>
                </div>
              )}

              {/* Collapsible Supabase pg_cron Command Inspector */}
              <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed var(--neo-border-color)' }}>
                <button
                  type="button"
                  onClick={() => setExpandedSqlId(isExpandedSql ? null : check.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 900,
                    color: 'var(--neo-cyan)'
                  }}
                >
                  <Code size={13} strokeWidth={2.5} />
                  <span>{isExpandedSql ? 'HIDE SUPABASE pg_cron SQL COMMAND' : 'INSPECT SUPABASE pg_cron SQL COMMAND (pg_net)'}</span>
                  {isExpandedSql ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {isExpandedSql && (
                  <div style={{ marginTop: '8px', background: '#090A0D', border: 'var(--neo-border-2)', padding: '10px 14px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--neo-cyan)', fontWeight: 800, marginBottom: '4px' }}>
                      POSTGRESQL CRON REGISTRATION STATEMENT (cron.job):
                    </div>
                    <pre className="font-mono" style={{ margin: 0, fontSize: '0.75rem', color: '#D8DAE2', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {pgCronData?.command || `SELECT cron.schedule('${pgCronData?.jobname || `probe_${check.id.slice(0, 8)}`}', '${pgCronData?.schedule || `*/${check.interval_minutes} * * * *`}', $$SELECT net.http_get(url := '${check.endpoint_url}');$$);`}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Health Check Modal */}
      {isAddOpen && (
        <div className="neo-modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="neo-modal-header neo-modal-header-green" style={{ padding: '20px 24px', borderBottom: 'var(--neo-border-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--neo-green)', color: '#000000' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} color="#000" strokeWidth={3} />
                <h3 style={{ fontSize: '1.25rem', color: '#000000', margin: 0, fontWeight: 900 }}>REGISTER MONITORED ENDPOINT & pg_cron</h3>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="btn-neo-outline" style={{ padding: '4px 8px', background: '#000000', color: '#FFFFFF', border: '2px solid #000000' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, marginBottom: '6px' }}>
                  CHECK NAME
                </label>
                <input
                  id="input-hc-name"
                  type="text"
                  required
                  placeholder="e.g. Edge CDN Ready Probe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="neo-input"
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, marginBottom: '6px' }}>
                  TARGET URL
                </label>
                <input
                  id="input-hc-url"
                  type="url"
                  required
                  placeholder="https://api.yourdomain.com/health"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  className="neo-input font-mono"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, marginBottom: '4px' }}>
                    HTTP METHOD
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="neo-input font-mono"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, marginBottom: '4px' }}>
                    EXPECTED CODE
                  </label>
                  <input
                    type="number"
                    value={expectedStatus}
                    onChange={(e) => setExpectedStatus(e.target.value)}
                    className="neo-input font-mono"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, marginBottom: '4px' }}>
                    INTERVAL (MINS)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(e.target.value)}
                    className="neo-input font-mono"
                  />
                </div>
              </div>

              {/* Supabase pg_cron Schedule Callout */}
              <div style={{
                background: 'var(--neo-surface-3)',
                border: 'var(--neo-border-2)',
                padding: '12px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--neo-cyan)' }}>
                    SUPABASE pg_cron SCHEDULE EXPRESSION
                  </div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.8, marginTop: '2px' }}>
                    PostgreSQL will automatically trigger this probe via <code className="font-mono">pg_net</code>
                  </div>
                </div>
                <div className="neo-badge neo-badge-yellow font-mono font-bold" style={{ fontSize: '0.92rem' }}>
                  {previewCronExpr}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, marginBottom: '6px' }}>
                  TIMEOUT (MS)
                </label>
                <input
                  type="number"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(e.target.value)}
                  className="neo-input font-mono"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, marginBottom: '6px' }}>
                  EXPECTED JSON BODY PATTERN (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder='{"status": "ok"}'
                  value={expectedJsonStr}
                  onChange={(e) => setExpectedJsonStr(e.target.value)}
                  className="neo-input font-mono"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <input
                  id="checkbox-maintenance"
                  type="checkbox"
                  checked={isMaintenance}
                  onChange={(e) => setIsMaintenance(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--neo-cyan)' }}
                />
                <label htmlFor="checkbox-maintenance" style={{ fontSize: '0.88rem', fontWeight: 900 }}>
                  START IN MAINTENANCE MODE (PAUSES pg_cron & SILENCES ALERTS)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn-neo-outline">
                  Cancel
                </button>
                <button
                  id="btn-submit-hc"
                  type="submit"
                  disabled={saving}
                  className="btn-neo-primary"
                >
                  {saving ? 'Registering...' : 'Register Probe & pg_cron'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Health Check History Modal with Pagination */}
      {historyCheck && (
        <div className="neo-modal-overlay" onClick={handleCloseHistory}>
          <div
            className="neo-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '840px', width: '95%' }}
          >
            {/* Modal Header */}
            <div
              className="neo-modal-header neo-modal-header-yellow"
              style={{
                padding: '18px 24px',
                borderBottom: 'var(--neo-border-4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--neo-yellow)',
                color: '#000000'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={22} color="#000000" strokeWidth={3} />
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: '#000000', margin: 0, fontWeight: 900 }}>
                    HEALTH CHECK CALL HISTORY
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#000000', fontWeight: 800, marginTop: '2px' }}>
                    {historyCheck.name} {historyCheck.endpoint_url ? `• ${historyCheck.endpoint_url}` : ''}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseHistory}
                className="btn-neo-outline"
                style={{
                  padding: '4px 8px',
                  background: '#000000',
                  color: '#FFFFFF',
                  border: '2px solid #000000',
                  fontWeight: 900,
                  fontSize: '1rem',
                  lineHeight: 1
                }}
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px' }}>
              {/* Summary Stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '12px',
                  marginBottom: '20px',
                  padding: '14px',
                  background: 'var(--neo-surface-2)',
                  border: 'var(--neo-border-2)'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 900, opacity: 0.8 }}>TOTAL LOGGED RUNS</div>
                  <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 900, marginTop: '2px' }}>
                    {historyLogs.length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 900, opacity: 0.8 }}>SUCCESSFUL CALLS</div>
                  <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#16A34A', marginTop: '2px' }}>
                    {historyLogs.filter(l => l.is_success).length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 900, opacity: 0.8 }}>FAILED CALLS</div>
                  <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#E11D48', marginTop: '2px' }}>
                    {historyLogs.filter(l => !l.is_success).length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 900, opacity: 0.8 }}>AVG LATENCY</div>
                  <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--neo-cyan)', marginTop: '2px' }}>
                    {historyLogs.length > 0
                      ? `${Math.round(historyLogs.reduce((acc, l) => acc + (l.response_time_ms || 0), 0) / historyLogs.length)} MS`
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Table or Empty State */}
              {loadingHistory && historyLogs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', fontWeight: 900 }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} strokeWidth={3} />
                  <span>FETCHING EXECUTION CALL LOGS...</span>
                </div>
              ) : historyLogs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', opacity: 0.7, fontStyle: 'italic' }}>
                  No execution call logs recorded yet for this health check.
                </div>
              ) : (
                (() => {
                  const totalLogs = historyLogs.length;
                  const totalPages = Math.ceil(totalLogs / historyPageSize) || 1;
                  const startIndex = (historyPage - 1) * historyPageSize;
                  const currentLogs = historyLogs.slice(startIndex, startIndex + historyPageSize);

                  return (
                    <>
                      <div style={{ overflowX: 'auto', border: 'var(--neo-border-2)', background: 'var(--neo-surface-1)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--neo-surface-3)', borderBottom: 'var(--neo-border-2)', textAlign: 'left' }}>
                              <th style={{ padding: '10px 12px', fontWeight: 900 }}>STATUS</th>
                              <th style={{ padding: '10px 12px', fontWeight: 900 }}>OUTCOME</th>
                              <th style={{ padding: '10px 12px', fontWeight: 900 }}>LATENCY</th>
                              <th style={{ padding: '10px 12px', fontWeight: 900 }}>TIMESTAMP</th>
                              <th style={{ padding: '10px 12px', fontWeight: 900 }}>DETAILS / MESSAGE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentLogs.map((log) => {
                              const isOk = log.is_success;
                              return (
                                <tr key={log.id} style={{ borderBottom: '1px solid var(--neo-border-color)' }}>
                                  <td style={{ padding: '10px 12px' }}>
                                    <span
                                      className={`neo-badge ${isOk ? 'neo-badge-green' : 'neo-badge-red'} font-mono`}
                                      style={{ fontSize: '0.74rem', padding: '2px 8px' }}
                                    >
                                      {log.status_code ? `HTTP ${log.status_code}` : 'CONN_ERR'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>
                                    <span style={{ fontWeight: 800, color: isOk ? '#16A34A' : '#E11D48', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      {isOk ? <CheckCircle2 size={13} strokeWidth={3} /> : <XCircle size={13} strokeWidth={3} />}
                                      {isOk ? 'SUCCESS' : 'FAILED'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 12px' }} className="font-mono font-bold">
                                    {log.response_time_ms != null ? `${log.response_time_ms} ms` : '—'}
                                  </td>
                                  <td style={{ padding: '10px 12px' }} className="font-mono text-xs opacity-90">
                                    {new Date(log.checked_at).toLocaleString()}
                                  </td>
                                  <td style={{ padding: '10px 12px', fontSize: '0.78rem' }} className="font-mono opacity-80">
                                    {log.error_message || (isOk ? 'Expected status matched successfully' : 'Probe failed')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px',
                          marginTop: '16px',
                          paddingTop: '12px'
                        }}
                      >
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, opacity: 0.8 }}>
                          Showing {startIndex + 1}–{Math.min(startIndex + historyPageSize, totalLogs)} of {totalLogs} calls
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '0.78rem', fontWeight: 800 }}>Rows:</label>
                          <select
                            value={historyPageSize}
                            onChange={(e) => {
                              setHistoryPageSize(Number(e.target.value));
                              setHistoryPage(1);
                            }}
                            className="neo-input font-mono"
                            style={{ padding: '3px 8px', fontSize: '0.78rem', width: 'auto' }}
                          >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                          </select>

                          <button
                            onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                            disabled={historyPage <= 1}
                            className="btn-neo-outline"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            title="Previous page"
                          >
                            <ChevronLeft size={14} strokeWidth={3} />
                          </button>

                          <span className="font-mono" style={{ fontWeight: 900, fontSize: '0.82rem', padding: '0 4px' }}>
                            {historyPage} / {totalPages}
                          </span>

                          <button
                            onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                            disabled={historyPage >= totalPages}
                            className="btn-neo-outline"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            title="Next page"
                          >
                            <ChevronRight size={14} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()
              )}

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: 'var(--neo-border-2)' }}>
                <button
                  type="button"
                  onClick={handleCloseHistory}
                  className="btn-neo-outline"
                  style={{ padding: '8px 20px', fontWeight: 900 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
