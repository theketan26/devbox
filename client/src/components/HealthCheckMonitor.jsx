import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import ConfirmModal from './ConfirmModal.jsx';
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
  ChevronRight,
  Edit2,
  Calendar,
  Sparkles,
  Check
} from 'lucide-react';
import {
  CRON_PRESETS,
  isValidCron,
  normalizeCron,
  describeCron,
  intervalToCronExpression,
  cronToIntervalMinutes,
  getNextCronRun
} from '../utils/cronHelper.js';

export default function HealthCheckMonitor({ activeApplicationId }) {
  const [checks, setChecks] = useState([]);
  const [pgCrons, setPgCrons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pingingId, setPingingId] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPgCronRegistryOpen, setIsPgCronRegistryOpen] = useState(false);
  const [expandedSqlId, setExpandedSqlId] = useState(null);
  const [syncingCrons, setSyncingCrons] = useState(false);

  // Direct Cron Update modal state
  const [cronModalCheck, setCronModalCheck] = useState(null);
  const [directCronPreset, setDirectCronPreset] = useState('*/5 * * * *');
  const [directCronCustom, setDirectCronCustom] = useState('*/5 * * * *');
  const [savingDirectCron, setSavingDirectCron] = useState(false);
  const [directCronSuccessMsg, setDirectCronSuccessMsg] = useState('');

  // Delete confirmation modal state
  const [checkToDelete, setCheckToDelete] = useState(null);
  const [deletingCheck, setDeletingCheck] = useState(false);

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
  const [headersStr, setHeadersStr] = useState('');
  const [requestBodyStr, setRequestBodyStr] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [addCronPreset, setAddCronPreset] = useState('*/5 * * * *');
  const [addCronCustom, setAddCronCustom] = useState('*/5 * * * *');
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [expectedJsonStr, setExpectedJsonStr] = useState('');
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit Form state
  const [editingCheck, setEditingCheck] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEndpointUrl, setEditEndpointUrl] = useState('');
  const [editMethod, setEditMethod] = useState('GET');
  const [editHeadersStr, setEditHeadersStr] = useState('');
  const [editRequestBodyStr, setEditRequestBodyStr] = useState('');
  const [editIntervalMinutes, setEditIntervalMinutes] = useState(5);
  const [editCronPreset, setEditCronPreset] = useState('*/5 * * * *');
  const [editCronCustom, setEditCronCustom] = useState('*/5 * * * *');
  const [editTimeoutMs, setEditTimeoutMs] = useState(5000);
  const [editExpectedStatus, setEditExpectedStatus] = useState(200);
  const [editExpectedJsonStr, setEditExpectedJsonStr] = useState('');
  const [editIsMaintenance, setEditIsMaintenance] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

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
      const pingResult = await api.healthChecks.ping(id);
      setChecks(prev =>
        prev.map(c =>
          c.id === id
            ? {
                ...c,
                last_status_code: pingResult.statusCode,
                last_response_time_ms: pingResult.responseTimeMs,
                current_status: pingResult.currentStatus,
                consecutive_failures: pingResult.consecutiveFailures,
                last_checked_at: new Date().toISOString()
              }
            : c
        )
      );
      fetchChecks();
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

  const handleConfirmDelete = async () => {
    if (!checkToDelete) return;
    setDeletingCheck(true);
    try {
      await api.healthChecks.delete(checkToDelete.id);
      setChecks(prev => prev.filter(c => c.id !== checkToDelete.id));
      setPgCrons(prev => prev.filter(j => j.health_check_id !== checkToDelete.id));
      setCheckToDelete(null);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingCheck(false);
    }
  };

  const handleOpenDirectCron = (check) => {
    if (!check) return;
    setCronModalCheck(check);
    const cur = check.cron_schedule || check.pg_cron?.schedule || intervalToCronExpression(check.interval_minutes);
    const matched = CRON_PRESETS.find(p => p.value === cur && p.value !== 'custom');
    if (matched) {
      setDirectCronPreset(matched.value);
      setDirectCronCustom(matched.value);
    } else {
      setDirectCronPreset('custom');
      setDirectCronCustom(cur || '0 0 * * *');
    }
    setDirectCronSuccessMsg('');
  };

  const handleCloseDirectCron = () => {
    setCronModalCheck(null);
    setSavingDirectCron(false);
    setDirectCronSuccessMsg('');
  };

  const handleSaveDirectCron = async (e) => {
    if (e) e.preventDefault();
    if (!cronModalCheck) return;

    const finalCron = directCronPreset === 'custom' ? directCronCustom.trim() : directCronPreset;
    if (!isValidCron(finalCron)) {
      alert('Please provide a valid 5-part cron expression (e.g. 0 0 * * *)');
      return;
    }

    setSavingDirectCron(true);
    try {
      const res = await api.healthChecks.updateCron(cronModalCheck.id, finalCron);
      const updatedCheck = res.check || {};
      setChecks(prev =>
        prev.map(c =>
          c.id === cronModalCheck.id
            ? {
                ...c,
                ...updatedCheck,
                cron_schedule: finalCron,
                cron_description: describeCron(finalCron),
                pg_cron: res.pg_cron || c.pg_cron
              }
            : c
        )
      );
      setDirectCronSuccessMsg(`✓ Schedule updated to: ${finalCron} (${describeCron(finalCron)})`);
      setTimeout(() => {
        handleCloseDirectCron();
        fetchChecks();
      }, 900);
    } catch (err) {
      alert(`Failed to update cron schedule: ${err.message}`);
    } finally {
      setSavingDirectCron(false);
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

    const finalCron = addCronPreset === 'custom' ? addCronCustom.trim() : addCronPreset;
    if (!isValidCron(finalCron)) {
      alert('Please enter a valid 5-part cron expression (e.g. */5 * * * *)');
      return;
    }
    const computedMinutes = cronToIntervalMinutes(finalCron);

    setSaving(true);
    try {
      const appId = activeApplicationId || (checks[0]?.application_id || 'default');
      await api.healthChecks.create({
        application_id: appId,
        name,
        endpoint_url: endpointUrl,
        method,
        headers: headersStr.trim() || null,
        request_body: requestBodyStr.trim() || null,
        interval_minutes: computedMinutes,
        cron_schedule: finalCron,
        timeout_ms: Number(timeoutMs),
        expected_status: Number(expectedStatus),
        expected_json_payload: parsedJson,
        is_maintenance_mode: isMaintenance
      });
      setName('');
      setEndpointUrl('');
      setHeadersStr('');
      setRequestBodyStr('');
      setExpectedJsonStr('');
      setAddCronPreset('*/5 * * * *');
      setAddCronCustom('*/5 * * * *');
      setIsAddOpen(false);
      fetchChecks();
    } catch (err) {
      alert(`Failed to create health check: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (check) => {
    if (!check) return;
    setEditingCheck(check);
    setEditName(check.name || '');
    setEditEndpointUrl(check.endpoint_url || '');
    setEditMethod(check.method || 'GET');
    setEditHeadersStr(
      check.headers
        ? (typeof check.headers === 'object'
            ? JSON.stringify(check.headers, null, 2)
            : String(check.headers))
        : ''
    );
    setEditRequestBodyStr(
      check.request_body !== undefined && check.request_body !== null
        ? (typeof check.request_body === 'object'
            ? JSON.stringify(check.request_body, null, 2)
            : String(check.request_body))
        : ''
    );
    setEditIntervalMinutes(check.interval_minutes || 5);
    setEditTimeoutMs(check.timeout_ms || 5000);
    setEditExpectedStatus(check.expected_status || 200);

    const cur = check.cron_schedule || check.pg_cron?.schedule || intervalToCronExpression(check.interval_minutes);
    const matched = CRON_PRESETS.find(p => p.value === cur && p.value !== 'custom');
    if (matched) {
      setEditCronPreset(matched.value);
      setEditCronCustom(matched.value);
    } else {
      setEditCronPreset('custom');
      setEditCronCustom(cur || '0 0 * * *');
    }

    setEditExpectedJsonStr(
      check.expected_json_payload
        ? (typeof check.expected_json_payload === 'string'
            ? check.expected_json_payload
            : JSON.stringify(check.expected_json_payload, null, 2))
        : ''
    );
    setEditIsMaintenance(Boolean(check.is_maintenance_mode));
  };

  const handleCloseEdit = () => {
    setEditingCheck(null);
    setSavingEdit(false);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingCheck) return;
    if (!editName.trim() || !editEndpointUrl.trim()) {
      alert('Please provide a name and endpoint URL.');
      return;
    }

    let parsedJson = null;
    if (editExpectedJsonStr.trim()) {
      try {
        parsedJson = JSON.parse(editExpectedJsonStr);
      } catch {
        alert('Invalid JSON in Expected JSON Payload');
        return;
      }
    }

    const finalEditCron = editCronPreset === 'custom' ? editCronCustom.trim() : editCronPreset;
    if (!isValidCron(finalEditCron)) {
      alert('Please enter a valid 5-part cron expression (e.g. 0 0 * * *)');
      return;
    }
    const editMinutes = cronToIntervalMinutes(finalEditCron);

    setSavingEdit(true);
    try {
      const payload = {
        name: editName.trim(),
        endpoint_url: editEndpointUrl.trim(),
        method: editMethod,
        headers: editHeadersStr.trim() || null,
        request_body: editRequestBodyStr.trim() || null,
        interval_minutes: editMinutes,
        cron_schedule: finalEditCron,
        timeout_ms: Number(editTimeoutMs),
        expected_status: Number(editExpectedStatus),
        expected_json_payload: parsedJson,
        is_maintenance_mode: editIsMaintenance
      };

      const updated = await api.healthChecks.update(editingCheck.id, payload);
      setChecks(prev =>
        prev.map(c =>
          c.id === editingCheck.id
            ? {
                ...c,
                ...updated,
                headers: updated.headers !== undefined ? updated.headers : (editHeadersStr.trim() || null),
                request_body: updated.request_body !== undefined ? updated.request_body : (editRequestBodyStr.trim() || null),
                cron_schedule: finalEditCron,
                cron_description: describeCron(finalEditCron)
              }
            : c
        )
      );
      handleCloseEdit();
      fetchChecks();
    } catch (err) {
      alert(`Failed to update health check: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  // Helper for resolved cron preview strings
  const getResolvedCron = (preset, custom) => (preset === 'custom' ? (custom.trim() || '* * * * *') : preset);
  const addResolvedCron = getResolvedCron(addCronPreset, addCronCustom);
  const editResolvedCron = getResolvedCron(editCronPreset, editCronCustom);
  const directResolvedCron = getResolvedCron(directCronPreset, directCronCustom);

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
          {/*
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
          */}

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
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              onClick={() => handleOpenDirectCron(matchedCheck || { id: targetCheckId, name: targetCheckName, cron_schedule: job.schedule, interval_minutes: job.interval_minutes })}
                              className="btn-neo-cyan"
                              style={{ padding: '4px 10px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                              title="Update cron schedule directly"
                            >
                              <Clock size={13} strokeWidth={2.5} />
                              <span>Cron</span>
                            </button>
                            {matchedCheck && (
                              <button
                                onClick={() => handleOpenEdit(matchedCheck)}
                                className="btn-neo-outline"
                                style={{ padding: '4px 10px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                title="Edit health check probe"
                              >
                                <Edit2 size={13} strokeWidth={2.5} />
                                <span>Edit</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenHistory(targetCheckId, targetCheckName)}
                              className="btn-neo-outline"
                              style={{ padding: '4px 10px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                              title="View health check call history and logs"
                            >
                              <History size={13} strokeWidth={2.5} />
                              <span>History</span>
                            </button>
                          </div>
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

                    {/* Headers & Body Badges */}
                    {check.headers && (
                      <span
                        className="neo-badge neo-badge-cyan font-mono"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title={typeof check.headers === 'object' ? JSON.stringify(check.headers) : String(check.headers)}
                      >
                        <Code size={12} />
                        <span>HEADERS: {typeof check.headers === 'object' ? Object.keys(check.headers).length : 'SET'}</span>
                      </span>
                    )}

                    {check.request_body && (
                      <span
                        className="neo-badge neo-badge-yellow font-mono"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title={typeof check.request_body === 'object' ? JSON.stringify(check.request_body) : String(check.request_body)}
                      >
                        <Terminal size={12} />
                        <span>BODY PAYLOAD</span>
                      </span>
                    )}
                  </div>

                  <div className="font-mono" style={{ fontSize: '0.88rem', fontWeight: 900, wordBreak: 'break-all', color: 'var(--neo-black)' }}>
                    {check.endpoint_url}
                  </div>

                  {/* Headers and Body preview bar */}
                  {(check.headers || check.request_body) && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {check.headers && (
                        <div style={{
                          background: 'var(--neo-surface-3)',
                          border: '1px solid var(--neo-border-color)',
                          padding: '3px 8px',
                          fontSize: '0.74rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span style={{ fontWeight: 900, color: 'var(--neo-cyan)' }}>HEADERS:</span>
                          <span className="font-mono" style={{ opacity: 0.9 }}>
                            {typeof check.headers === 'object'
                              ? Object.entries(check.headers).map(([k, v]) => `${k}: ${v}`).join(' | ')
                              : String(check.headers)}
                          </span>
                        </div>
                      )}
                      {check.request_body && (
                        <div style={{
                          background: 'var(--neo-surface-3)',
                          border: '1px solid var(--neo-border-color)',
                          padding: '3px 8px',
                          fontSize: '0.74rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span style={{ fontWeight: 900, color: 'var(--neo-yellow)' }}>BODY:</span>
                          <span className="font-mono" style={{ opacity: 0.9 }}>
                            {typeof check.request_body === 'object'
                              ? JSON.stringify(check.request_body)
                              : String(check.request_body)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Direct Cron Schedule Button */}
                  <button
                    id={`btn-cron-${check.id}`}
                    onClick={() => handleOpenDirectCron(check)}
                    className="btn-neo-cyan"
                    style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    title="Update cron schedule directly (Daily, Weekly, Hourly, Custom)"
                  >
                    <Clock size={14} strokeWidth={2.5} />
                    <span>CRON SCHEDULE</span>
                  </button>

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

                  {/* Edit Button */}
                  <button
                    id={`btn-edit-${check.id}`}
                    onClick={() => handleOpenEdit(check)}
                    className="btn-neo-outline"
                    style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    title="Edit health check probe configuration"
                  >
                    <Edit2 size={14} strokeWidth={2.5} />
                    <span>EDIT</span>
                  </button>

                  <button
                    onClick={() => setCheckToDelete({ id: check.id, name: check.name })}
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
                  <div style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>CRON SCHEDULE</span>
                    <button
                      type="button"
                      onClick={() => handleOpenDirectCron(check)}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.66rem', color: 'var(--neo-cyan)', cursor: 'pointer', fontWeight: 900, textDecoration: 'underline' }}
                      title="Update cron schedule directly"
                    >
                      CHANGE
                    </button>
                  </div>
                  <div style={{ marginTop: '2px' }}>
                    <button
                      type="button"
                      id={`badge-cron-${check.id}`}
                      onClick={() => handleOpenDirectCron(check)}
                      className="font-mono font-bold"
                      style={{
                        background: 'var(--neo-yellow)',
                        color: '#000',
                        padding: '2px 8px',
                        border: '1.5px solid #000',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.84rem'
                      }}
                      title="Click to update cron schedule directly"
                    >
                      <Clock size={11} strokeWidth={3} />
                      <span>{check.cron_schedule || pgCronData?.schedule || intervalToCronExpression(check.interval_minutes)}</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--neo-cyan)', marginTop: '3px' }}>
                    {check.cron_description || describeCron(check.cron_schedule || pgCronData?.schedule || intervalToCronExpression(check.interval_minutes))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.8 }}>NEXT PG_CRON RUN</div>
                  <div className="font-mono" style={{ fontSize: '0.84rem', fontWeight: 800, marginTop: '2px' }}>
                    {pgCronData?.next_run_at
                      ? new Date(pgCronData.next_run_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : getNextCronRun(check.cron_schedule || intervalToCronExpression(check.interval_minutes))
                        ? new Date(getNextCronRun(check.cron_schedule || intervalToCronExpression(check.interval_minutes))).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : `In ${check.interval_minutes}m`}
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, marginBottom: '4px' }}>
                    HTTP METHOD
                  </label>
                  <select
                    id="select-hc-method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="neo-input font-mono"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, marginBottom: '4px' }}>
                    EXPECTED CODE
                  </label>
                  <input
                    id="input-hc-status"
                    type="number"
                    value={expectedStatus}
                    onChange={(e) => setExpectedStatus(e.target.value)}
                    className="neo-input font-mono"
                  />
                </div>
              </div>

              {/* Custom HTTP Request Headers */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="input-hc-headers" style={{ fontSize: '0.78rem', fontWeight: 900 }}>
                    CUSTOM REQUEST HEADERS (OPTIONAL)
                  </label>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 700 }}>
                    JSON or "Header: Value" per line
                  </span>
                </div>
                <textarea
                  id="input-hc-headers"
                  rows={2}
                  placeholder={'{\n  "Authorization": "Bearer token123",\n  "X-API-Key": "my-secret-key"\n}'}
                  value={headersStr}
                  onChange={(e) => setHeadersStr(e.target.value)}
                  className="neo-input font-mono"
                  style={{ resize: 'vertical', fontSize: '0.8rem' }}
                />
              </div>

              {/* Custom Request Body / Payload */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="input-hc-body" style={{ fontSize: '0.78rem', fontWeight: 900 }}>
                    REQUEST BODY / PAYLOAD (OPTIONAL)
                  </label>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 700 }}>
                    JSON payload or raw text for POST / PUT / PATCH
                  </span>
                </div>
                <textarea
                  id="input-hc-body"
                  rows={2}
                  placeholder={'{\n  "status": "ping",\n  "source": "devbox-probe"\n}'}
                  value={requestBodyStr}
                  onChange={(e) => setRequestBodyStr(e.target.value)}
                  className="neo-input font-mono"
                  style={{ resize: 'vertical', fontSize: '0.8rem' }}
                />
              </div>

              {/* CRON TRIGGER SCHEDULE SELECTOR */}
              <div style={{ marginBottom: '16px', background: 'var(--neo-surface-2)', padding: '14px', border: 'var(--neo-border-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, color: 'var(--neo-cyan)' }}>
                    ⏱ CRON TRIGGER SCHEDULE (DAILY, WEEKLY, INTERVALS)
                  </label>
                  <span className="neo-badge neo-badge-yellow font-mono" style={{ fontSize: '0.74rem' }}>
                    {addResolvedCron}
                  </span>
                </div>

                {/* Quick preset chips */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {[
                    { label: '5 Mins', val: '*/5 * * * *' },
                    { label: '15 Mins', val: '*/15 * * * *' },
                    { label: 'Hourly', val: '0 * * * *' },
                    { label: 'Daily (Midnight)', val: '0 0 * * *' },
                    { label: 'Daily (9 AM)', val: '0 9 * * *' },
                    { label: 'Weekly (Sunday)', val: '0 0 * * 0' },
                    { label: 'Weekly (Monday)', val: '0 9 * * 1' },
                    { label: 'Custom...', val: 'custom' }
                  ].map(btn => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => {
                        setAddCronPreset(btn.val);
                        if (btn.val !== 'custom') setAddCronCustom(btn.val);
                      }}
                      className={addCronPreset === btn.val ? 'btn-neo-cyan' : 'btn-neo-outline'}
                      style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <select
                  value={addCronPreset}
                  onChange={(e) => {
                    setAddCronPreset(e.target.value);
                    if (e.target.value !== 'custom') setAddCronCustom(e.target.value);
                  }}
                  className="neo-input font-mono"
                  style={{ marginBottom: addCronPreset === 'custom' ? '10px' : '0' }}
                >
                  <optgroup label="Minutes">
                    <option value="* * * * *">Every minute (* * * * *)</option>
                    <option value="*/5 * * * *">Every 5 minutes (*/5 * * * *)</option>
                    <option value="*/10 * * * *">Every 10 minutes (*/10 * * * *)</option>
                    <option value="*/15 * * * *">Every 15 minutes (*/15 * * * *)</option>
                    <option value="*/30 * * * *">Every 30 minutes (*/30 * * * *)</option>
                  </optgroup>
                  <optgroup label="Hourly">
                    <option value="0 * * * *">Hourly at :00 (0 * * * *)</option>
                    <option value="0 */2 * * *">Every 2 hours (0 */2 * * *)</option>
                    <option value="0 */6 * * *">Every 6 hours (0 */6 * * *)</option>
                    <option value="0 */12 * * *">Every 12 hours (0 */12 * * *)</option>
                  </optgroup>
                  <optgroup label="Daily">
                    <option value="0 0 * * *">Daily at Midnight 00:00 UTC (0 0 * * *)</option>
                    <option value="0 9 * * *">Daily at 09:00 AM UTC (0 9 * * *)</option>
                    <option value="0 18 * * *">Daily at 06:00 PM UTC (0 18 * * *)</option>
                  </optgroup>
                  <optgroup label="Weekly">
                    <option value="0 0 * * 0">Weekly on Sunday at Midnight (0 0 * * 0)</option>
                    <option value="0 9 * * 1">Weekly on Monday at 09:00 AM (0 9 * * 1)</option>
                  </optgroup>
                  <optgroup label="Monthly">
                    <option value="0 0 1 * *">Monthly on 1st at Midnight (0 0 1 * *)</option>
                  </optgroup>
                  <optgroup label="Custom">
                    <option value="custom">Custom Cron Expression...</option>
                  </optgroup>
                </select>

                {addCronPreset === 'custom' && (
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 900, marginBottom: '4px' }}>
                      CUSTOM 5-FIELD CRON EXPRESSION (minute hour dom month dow):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 0 0 * * * or 30 2 * * 1-5"
                      value={addCronCustom}
                      onChange={(e) => setAddCronCustom(e.target.value)}
                      className="neo-input font-mono font-bold"
                    />
                    <div style={{ fontSize: '0.72rem', marginTop: '4px', color: isValidCron(addCronCustom) ? '#16A34A' : '#E11D48', fontWeight: 800 }}>
                      {isValidCron(addCronCustom) ? `✓ Valid Pattern: ${describeCron(addCronCustom)}` : '✗ Invalid 5-field cron pattern'}
                    </div>
                  </div>
                )}
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
                    SCHEDULE EXPLANATION & NEXT RUN
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.95, marginTop: '2px', fontWeight: 700 }}>
                    {describeCron(addResolvedCron)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 900, opacity: 0.7 }}>NEXT RUN PREVIEW</div>
                  <div className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                    {getNextCronRun(addResolvedCron) ? new Date(getNextCronRun(addResolvedCron)).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
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

      {/* Edit Health Check Modal */}
      {editingCheck && (
        <div className="neo-modal-overlay" onClick={handleCloseEdit}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div
              className="neo-modal-header neo-modal-header-cyan"
              style={{
                padding: '20px 24px',
                borderBottom: 'var(--neo-border-4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--neo-cyan)',
                color: '#000000'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={20} color="#000" strokeWidth={3} />
                <h3 style={{ fontSize: '1.25rem', color: '#000000', margin: 0, fontWeight: 900 }}>
                  EDIT HEALTH PROBE & pg_cron
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="btn-neo-outline"
                style={{ padding: '4px 8px', background: '#000000', color: '#FFFFFF', border: '2px solid #000000' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, marginBottom: '6px' }}>
                  CHECK NAME
                </label>
                <input
                  id="input-edit-hc-name"
                  type="text"
                  required
                  placeholder="e.g. Edge CDN Ready Probe"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="neo-input"
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, marginBottom: '6px' }}>
                  TARGET URL
                </label>
                <input
                  id="input-edit-hc-url"
                  type="url"
                  required
                  placeholder="https://api.yourdomain.com/health"
                  value={editEndpointUrl}
                  onChange={(e) => setEditEndpointUrl(e.target.value)}
                  className="neo-input font-mono"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, marginBottom: '4px' }}>
                    HTTP METHOD
                  </label>
                  <select
                    id="select-edit-hc-method"
                    value={editMethod}
                    onChange={(e) => setEditMethod(e.target.value)}
                    className="neo-input font-mono"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, marginBottom: '4px' }}>
                    EXPECTED CODE
                  </label>
                  <input
                    id="input-edit-hc-status"
                    type="number"
                    value={editExpectedStatus}
                    onChange={(e) => setEditExpectedStatus(e.target.value)}
                    className="neo-input font-mono"
                  />
                </div>
              </div>

              {/* Custom HTTP Request Headers */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="input-edit-hc-headers" style={{ fontSize: '0.78rem', fontWeight: 900 }}>
                    CUSTOM REQUEST HEADERS (OPTIONAL)
                  </label>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 700 }}>
                    JSON or "Header: Value" per line
                  </span>
                </div>
                <textarea
                  id="input-edit-hc-headers"
                  rows={2}
                  placeholder={'{\n  "Authorization": "Bearer token123",\n  "X-API-Key": "my-secret-key"\n}'}
                  value={editHeadersStr}
                  onChange={(e) => setEditHeadersStr(e.target.value)}
                  className="neo-input font-mono"
                  style={{ resize: 'vertical', fontSize: '0.8rem' }}
                />
              </div>

              {/* Custom Request Body / Payload */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="input-edit-hc-body" style={{ fontSize: '0.78rem', fontWeight: 900 }}>
                    REQUEST BODY / PAYLOAD (OPTIONAL)
                  </label>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 700 }}>
                    JSON payload or raw text for POST / PUT / PATCH
                  </span>
                </div>
                <textarea
                  id="input-edit-hc-body"
                  rows={2}
                  placeholder={'{\n  "status": "ping",\n  "source": "devbox-probe"\n}'}
                  value={editRequestBodyStr}
                  onChange={(e) => setEditRequestBodyStr(e.target.value)}
                  className="neo-input font-mono"
                  style={{ resize: 'vertical', fontSize: '0.8rem' }}
                />
              </div>

              {/* CRON TRIGGER SCHEDULE SELECTOR */}
              <div style={{ marginBottom: '16px', background: 'var(--neo-surface-2)', padding: '14px', border: 'var(--neo-border-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, color: 'var(--neo-cyan)' }}>
                    ⏱ CRON TRIGGER SCHEDULE (DAILY, WEEKLY, INTERVALS)
                  </label>
                  <span className="neo-badge neo-badge-yellow font-mono" style={{ fontSize: '0.74rem' }}>
                    {editResolvedCron}
                  </span>
                </div>

                {/* Quick preset chips */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {[
                    { label: '5 Mins', val: '*/5 * * * *' },
                    { label: '15 Mins', val: '*/15 * * * *' },
                    { label: 'Hourly', val: '0 * * * *' },
                    { label: 'Daily (Midnight)', val: '0 0 * * *' },
                    { label: 'Daily (9 AM)', val: '0 9 * * *' },
                    { label: 'Weekly (Sunday)', val: '0 0 * * 0' },
                    { label: 'Weekly (Monday)', val: '0 9 * * 1' },
                    { label: 'Custom...', val: 'custom' }
                  ].map(btn => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => {
                        setEditCronPreset(btn.val);
                        if (btn.val !== 'custom') setEditCronCustom(btn.val);
                      }}
                      className={editCronPreset === btn.val ? 'btn-neo-cyan' : 'btn-neo-outline'}
                      style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <select
                  id="select-edit-hc-schedule"
                  value={editCronPreset}
                  onChange={(e) => {
                    setEditCronPreset(e.target.value);
                    if (e.target.value !== 'custom') setEditCronCustom(e.target.value);
                  }}
                  className="neo-input font-mono"
                  style={{ marginBottom: editCronPreset === 'custom' ? '10px' : '0' }}
                >
                  <optgroup label="Minutes">
                    <option value="* * * * *">Every minute (* * * * *)</option>
                    <option value="*/5 * * * *">Every 5 minutes (*/5 * * * *)</option>
                    <option value="*/10 * * * *">Every 10 minutes (*/10 * * * *)</option>
                    <option value="*/15 * * * *">Every 15 minutes (*/15 * * * *)</option>
                    <option value="*/30 * * * *">Every 30 minutes (*/30 * * * *)</option>
                  </optgroup>
                  <optgroup label="Hourly">
                    <option value="0 * * * *">Hourly at :00 (0 * * * *)</option>
                    <option value="0 */2 * * *">Every 2 hours (0 */2 * * *)</option>
                    <option value="0 */6 * * *">Every 6 hours (0 */6 * * *)</option>
                    <option value="0 */12 * * *">Every 12 hours (0 */12 * * *)</option>
                  </optgroup>
                  <optgroup label="Daily">
                    <option value="0 0 * * *">Daily at Midnight 00:00 UTC (0 0 * * *)</option>
                    <option value="0 9 * * *">Daily at 09:00 AM UTC (0 9 * * *)</option>
                    <option value="0 18 * * *">Daily at 06:00 PM UTC (0 18 * * *)</option>
                  </optgroup>
                  <optgroup label="Weekly">
                    <option value="0 0 * * 0">Weekly on Sunday at Midnight (0 0 * * 0)</option>
                    <option value="0 9 * * 1">Weekly on Monday at 09:00 AM (0 9 * * 1)</option>
                  </optgroup>
                  <optgroup label="Monthly">
                    <option value="0 0 1 * *">Monthly on 1st at Midnight (0 0 1 * *)</option>
                  </optgroup>
                  <optgroup label="Custom">
                    <option value="custom">Custom Cron Expression...</option>
                  </optgroup>
                </select>

                {editCronPreset === 'custom' && (
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 900, marginBottom: '4px' }}>
                      CUSTOM 5-FIELD CRON EXPRESSION (minute hour dom month dow):
                    </label>
                    <input
                      id="input-edit-hc-custom-cron"
                      type="text"
                      placeholder="e.g. 0 0 * * * or 30 2 * * 1-5"
                      value={editCronCustom}
                      onChange={(e) => setEditCronCustom(e.target.value)}
                      className="neo-input font-mono font-bold"
                    />
                    <div style={{ fontSize: '0.72rem', marginTop: '4px', color: isValidCron(editCronCustom) ? '#16A34A' : '#E11D48', fontWeight: 800 }}>
                      {isValidCron(editCronCustom) ? `✓ Valid Pattern: ${describeCron(editCronCustom)}` : '✗ Invalid 5-field cron pattern'}
                    </div>
                  </div>
                )}
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
                    SCHEDULE EXPLANATION & NEXT RUN
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.95, marginTop: '2px', fontWeight: 700 }}>
                    {describeCron(editResolvedCron)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 900, opacity: 0.7 }}>NEXT RUN PREVIEW</div>
                  <div className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                    {getNextCronRun(editResolvedCron) ? new Date(getNextCronRun(editResolvedCron)).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, marginBottom: '6px' }}>
                  TIMEOUT (MS)
                </label>
                <input
                  id="input-edit-hc-timeout"
                  type="number"
                  value={editTimeoutMs}
                  onChange={(e) => setEditTimeoutMs(e.target.value)}
                  className="neo-input font-mono"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, marginBottom: '6px' }}>
                  EXPECTED JSON BODY PATTERN (OPTIONAL)
                </label>
                <input
                  id="input-edit-hc-json"
                  type="text"
                  placeholder='{"status": "ok"}'
                  value={editExpectedJsonStr}
                  onChange={(e) => setEditExpectedJsonStr(e.target.value)}
                  className="neo-input font-mono"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <input
                  id="checkbox-edit-maintenance"
                  type="checkbox"
                  checked={editIsMaintenance}
                  onChange={(e) => setEditIsMaintenance(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--neo-cyan)' }}
                />
                <label htmlFor="checkbox-edit-maintenance" style={{ fontSize: '0.88rem', fontWeight: 900, cursor: 'pointer' }}>
                  MAINTENANCE MODE (PAUSES pg_cron & SILENCES ALERTS)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={handleCloseEdit} className="btn-neo-outline">
                  Cancel
                </button>
                <button
                  id="btn-update-hc"
                  type="submit"
                  disabled={savingEdit}
                  className="btn-neo-cyan"
                >
                  {savingEdit ? 'Saving Changes...' : 'Save Probe Changes'}
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

      {/* Direct Cron Schedule Update Modal */}
      {cronModalCheck && (
        <div className="neo-modal-overlay" onClick={handleCloseDirectCron}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div
              className="neo-modal-header neo-modal-header-cyan"
              style={{
                padding: '20px 24px',
                borderBottom: 'var(--neo-border-4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--neo-cyan)',
                color: '#000000'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={20} color="#000" strokeWidth={3} />
                <h3 style={{ fontSize: '1.25rem', color: '#000000', margin: 0, fontWeight: 900 }}>
                  UPDATE CRON SCHEDULE DIRECTLY
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseDirectCron}
                className="btn-neo-outline"
                style={{ padding: '4px 8px', background: '#000000', color: '#FFFFFF', border: '2px solid #000000' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDirectCron} style={{ padding: '24px' }}>
              {/* Probe info banner */}
              <div
                style={{
                  background: 'var(--neo-surface-3)',
                  border: 'var(--neo-border-2)',
                  padding: '12px 14px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ fontSize: '0.74rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.8 }}>
                  TARGET HEALTH PROBE
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, marginTop: '2px' }}>
                  {cronModalCheck.name}
                </div>
                <div className="font-mono text-xs opacity-80" style={{ wordBreak: 'break-all', marginTop: '2px' }}>
                  {cronModalCheck.endpoint_url}
                </div>
              </div>

              {/* Quick Preset Selector Buttons */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, marginBottom: '8px' }}>
                  CHOOSE A CRON TRIGGER FREQUENCY:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                  {[
                    { label: 'Every 1 Min', expr: '* * * * *', cat: 'Minutes' },
                    { label: 'Every 5 Mins', expr: '*/5 * * * *', cat: 'Minutes' },
                    { label: 'Every 15 Mins', expr: '*/15 * * * *', cat: 'Minutes' },
                    { label: 'Every 30 Mins', expr: '*/30 * * * *', cat: 'Minutes' },
                    { label: 'Hourly (:00)', expr: '0 * * * *', cat: 'Hourly' },
                    { label: 'Every 2 Hours', expr: '0 */2 * * *', cat: 'Hourly' },
                    { label: 'Every 6 Hours', expr: '0 */6 * * *', cat: 'Hourly' },
                    { label: 'Daily (Midnight)', expr: '0 0 * * *', cat: 'Daily' },
                    { label: 'Daily (09:00 AM)', expr: '0 9 * * *', cat: 'Daily' },
                    { label: 'Daily (06:00 PM)', expr: '0 18 * * *', cat: 'Daily' },
                    { label: 'Weekly (Sunday)', expr: '0 0 * * 0', cat: 'Weekly' },
                    { label: 'Weekly (Monday)', expr: '0 9 * * 1', cat: 'Weekly' },
                    { label: 'Monthly (1st)', expr: '0 0 1 * *', cat: 'Monthly' },
                    { label: 'Custom Cron...', expr: 'custom', cat: 'Custom' }
                  ].map(opt => {
                    const isSelected = directCronPreset === opt.expr;
                    return (
                      <button
                        key={opt.expr}
                        type="button"
                        onClick={() => {
                          setDirectCronPreset(opt.expr);
                          if (opt.expr !== 'custom') setDirectCronCustom(opt.expr);
                        }}
                        className={isSelected ? 'btn-neo-cyan' : 'btn-neo-outline'}
                        style={{
                          padding: '8px 10px',
                          fontSize: '0.78rem',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px'
                        }}
                      >
                        <span style={{ fontWeight: 900 }}>{opt.label}</span>
                        {opt.expr !== 'custom' && (
                          <span className="font-mono text-xs opacity-75">{opt.expr}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Dropdown for comprehensive list */}
                <select
                  id="select-direct-cron-preset"
                  value={directCronPreset}
                  onChange={(e) => {
                    setDirectCronPreset(e.target.value);
                    if (e.target.value !== 'custom') setDirectCronCustom(e.target.value);
                  }}
                  className="neo-input font-mono"
                  style={{ marginBottom: directCronPreset === 'custom' ? '12px' : '0' }}
                >
                  <optgroup label="Minutes">
                    <option value="* * * * *">Every minute (* * * * *)</option>
                    <option value="*/5 * * * *">Every 5 minutes (*/5 * * * *)</option>
                    <option value="*/10 * * * *">Every 10 minutes (*/10 * * * *)</option>
                    <option value="*/15 * * * *">Every 15 minutes (*/15 * * * *)</option>
                    <option value="*/30 * * * *">Every 30 minutes (*/30 * * * *)</option>
                  </optgroup>
                  <optgroup label="Hourly">
                    <option value="0 * * * *">Hourly at minute 0 (0 * * * *)</option>
                    <option value="0 */2 * * *">Every 2 hours (0 */2 * * *)</option>
                    <option value="0 */6 * * *">Every 6 hours (0 */6 * * *)</option>
                    <option value="0 */12 * * *">Every 12 hours (0 */12 * * *)</option>
                  </optgroup>
                  <optgroup label="Daily">
                    <option value="0 0 * * *">Daily at Midnight 00:00 UTC (0 0 * * *)</option>
                    <option value="0 9 * * *">Daily at 09:00 AM UTC (0 9 * * *)</option>
                    <option value="0 18 * * *">Daily at 06:00 PM UTC (0 18 * * *)</option>
                  </optgroup>
                  <optgroup label="Weekly">
                    <option value="0 0 * * 0">Weekly on Sunday at 00:00 UTC (0 0 * * 0)</option>
                    <option value="0 9 * * 1">Weekly on Monday at 09:00 AM UTC (0 9 * * 1)</option>
                  </optgroup>
                  <optgroup label="Monthly">
                    <option value="0 0 1 * *">Monthly on 1st at 00:00 UTC (0 0 1 * *)</option>
                  </optgroup>
                  <optgroup label="Custom">
                    <option value="custom">Custom Cron Expression...</option>
                  </optgroup>
                </select>

                {directCronPreset === 'custom' && (
                  <div style={{ marginTop: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, marginBottom: '6px' }}>
                      CUSTOM 5-FIELD CRON EXPRESSION (minute hour dom month dow):
                    </label>
                    <input
                      id="input-direct-cron-custom"
                      type="text"
                      placeholder="e.g. 0 0 * * * or 30 2 * * 1-5"
                      value={directCronCustom}
                      onChange={(e) => setDirectCronCustom(e.target.value)}
                      className="neo-input font-mono font-bold"
                      autoFocus
                    />
                    <div style={{ fontSize: '0.74rem', marginTop: '6px', color: isValidCron(directCronCustom) ? '#16A34A' : '#E11D48', fontWeight: 800 }}>
                      {isValidCron(directCronCustom)
                        ? `✓ Valid Pattern: ${describeCron(directCronCustom)}`
                        : '✗ Invalid 5-field cron pattern (expected format: minute hour dom month dow)'}
                    </div>
                  </div>
                )}
              </div>

              {/* Schedule Preview & Next Run Box */}
              <div
                style={{
                  background: 'var(--neo-surface-2)',
                  border: 'var(--neo-border-3)',
                  padding: '14px 16px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--neo-cyan)' }}>
                    RESOLVED SCHEDULE PREVIEW
                  </div>
                  <code
                    className="font-mono font-bold"
                    style={{ background: 'var(--neo-yellow)', color: '#000', padding: '3px 8px', border: '1.5px solid #000', fontSize: '0.92rem' }}
                  >
                    {directResolvedCron}
                  </code>
                </div>

                <div style={{ fontSize: '0.88rem', fontWeight: 900, marginBottom: '6px' }}>
                  {describeCron(directResolvedCron)}
                </div>

                <div style={{ fontSize: '0.76rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={13} strokeWidth={2.5} />
                  <span>
                    Next Execution:{' '}
                    <strong>
                      {getNextCronRun(directResolvedCron)
                        ? new Date(getNextCronRun(directResolvedCron)).toLocaleString()
                        : 'Pending'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Success Feedback Alert */}
              {directCronSuccessMsg && (
                <div
                  style={{
                    background: 'var(--neo-green)',
                    color: '#000000',
                    border: 'var(--neo-border-2)',
                    padding: '10px 14px',
                    fontWeight: 900,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Check size={16} strokeWidth={3} />
                  <span>{directCronSuccessMsg}</span>
                </div>
              )}

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handleCloseDirectCron}
                  className="btn-neo-outline"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-direct-cron"
                  type="submit"
                  disabled={savingDirectCron || !isValidCron(directResolvedCron)}
                  className="btn-neo-cyan"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Clock size={15} strokeWidth={2.5} />
                  <span>{savingDirectCron ? 'Updating...' : 'Update Cron Schedule Now'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(checkToDelete)}
        title="Delete Health Check"
        message={`Are you sure you want to delete health check "${checkToDelete?.name}"?`}
        warningNote="This will permanently delete this probe and unschedule its automated Supabase pg_cron job."
        confirmText="Yes, Delete Probe"
        loading={deletingCheck}
        onConfirm={handleConfirmDelete}
        onClose={() => setCheckToDelete(null)}
      />
    </div>
  );
}
