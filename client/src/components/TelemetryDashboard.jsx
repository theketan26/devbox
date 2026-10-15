import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import {
  Cpu,
  Database,
  HardDrive,
  Clock,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  Activity,
  Zap
} from 'lucide-react';

export default function TelemetryDashboard({ applications, activeApplicationId }) {
  const [selectedAppId, setSelectedAppId] = useState(activeApplicationId || (applications[0]?.id || ''));
  const [metrics, setMetrics] = useState([]);
  const [appDetails, setAppDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  useEffect(() => {
    if (activeApplicationId) {
      setSelectedAppId(activeApplicationId);
    } else if (!selectedAppId && applications.length > 0) {
      setSelectedAppId(applications[0].id);
    }
  }, [activeApplicationId, applications]);

  const fetchTelemetry = async () => {
    if (!selectedAppId) return;
    setLoading(true);
    try {
      const [history, detail] = await Promise.all([
        api.telemetry.getHistory(selectedAppId),
        api.applications.get(selectedAppId)
      ]);
      setMetrics(history);
      setAppDetails(detail);
    } catch (err) {
      console.error('Failed to load telemetry data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 15000);
    return () => clearInterval(interval);
  }, [selectedAppId]);

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const newPoint = await api.telemetry.simulate(selectedAppId);
      setMetrics(prev => [...prev.slice(-24), newPoint]);
    } catch (err) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  const handleCopyToken = async () => {
    if (appDetails?.telemetry_token) {
      await navigator.clipboard.writeText(appDetails.telemetry_token);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const latest = metrics[metrics.length - 1] || {
    cpu_usage_pct: 14.2,
    memory_rss_mb: 164.5,
    memory_heap_mb: 88.3,
    db_active_connections: 8,
    uptime_seconds: 345600
  };

  function formatUptime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}D ${hours}H ${mins}M`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header and App Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--neo-yellow)',
            border: 'var(--neo-border-2)',
            boxShadow: '3px 3px 0px #000',
            padding: '3px 8px',
            fontWeight: 900,
            fontSize: '0.74rem',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            <Zap size={14} strokeWidth={3} />
            <span>Telemetry Pipeline</span>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900 }}>
            APPLICATION TELEMETRY INGESTION
          </h1>
          <p style={{ color: 'var(--neo-black)', opacity: 0.75, fontSize: '0.95rem', marginTop: '6px', fontWeight: 700 }}>
            Live timeseries ingestion of CPU usage, RSS/Heap memory footprint, and DB connections.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            id="select-telemetry-app"
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            className="neo-input font-mono"
            style={{ width: 'auto', minWidth: '200px' }}
          >
            {applications.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <button
            id="btn-simulate-telemetry"
            onClick={handleSimulate}
            disabled={simulating}
            className="btn-neo-secondary"
            title="Inject an immediate synthetic metric point"
          >
            <Zap size={15} strokeWidth={3} className={simulating ? 'animate-spin' : ''} />
            <span>Simulate Ingestion</span>
          </button>
        </div>
      </div>

      {/* 4 Live Metric Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        {/* CPU */}
        <div className="neo-card-yellow">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>CPU LOAD</div>
              <div className="font-mono" style={{ fontSize: '2.8rem', fontWeight: 900, marginTop: '4px', lineHeight: 1 }}>
                {latest.cpu_usage_pct}%
              </div>
            </div>
            <div style={{ padding: '8px', background: '#000', color: 'var(--neo-black)' }}>
              <Cpu size={22} strokeWidth={3} />
            </div>
          </div>
          <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.5)', border: '2px solid var(--neo-yellow)', height: '14px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, latest.cpu_usage_pct)}%`, height: '100%', background: 'var(--neo-yellow)' }} />
          </div>
        </div>

        {/* Memory RSS */}
        <div className="neo-card-violet">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>MEMORY (RSS / HEAP)</div>
              <div className="font-mono" style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '4px', lineHeight: 1 }}>
                {latest.memory_rss_mb} <span style={{ fontSize: '1rem' }}>MB</span>
              </div>
            </div>
            <div style={{ padding: '8px', background: '#000', color: 'var(--neo-black)' }}>
              <HardDrive size={22} strokeWidth={3} />
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 900, marginTop: '16px', borderTop: '2px solid rgba(255,255,255,0.12)', paddingTop: '6px' }}>
            HEAP ALLOCATED: {latest.memory_heap_mb} MB
          </div>
        </div>

        {/* Database Active Pool Connections */}
        <div className="neo-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>ACTIVE DB POOL</div>
              <div className="font-mono" style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '4px', lineHeight: 1 }}>
                {latest.db_active_connections} <span style={{ fontSize: '1rem' }}>CONNS</span>
              </div>
            </div>
            <div style={{ padding: '8px', background: 'var(--neo-green)', color: '#000', border: '2px solid #000' }}>
              <Database size={22} strokeWidth={3} />
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 900, marginTop: '16px', borderTop: '2px solid rgba(255,255,255,0.12)', paddingTop: '6px' }}>
            POSTGRESQL POOL NORMAL
          </div>
        </div>

        {/* Uptime */}
        <div className="neo-card-red">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>PROCESS UPTIME</div>
              <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '8px', lineHeight: 1 }}>
                {formatUptime(latest.uptime_seconds)}
              </div>
            </div>
            <div style={{ padding: '8px', background: '#000', color: 'var(--neo-black)' }}>
              <Clock size={22} strokeWidth={3} />
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 900, marginTop: '16px', borderTop: '2px solid rgba(255,255,255,0.12)', paddingTop: '6px' }}>
            CONTINUOUS PROCESS WORKLOAD
          </div>
        </div>
      </div>

      {/* Visual Retro Histogram */}
      <div className="neo-card-static">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.2rem' }}>TELEMETRY TIMESERIES HISTOGRAM</h3>
          <span className="neo-badge neo-badge-yellow" style={{ fontSize: '0.72rem' }}>LAST 15 INGESTION SAMPLES</span>
        </div>

        {metrics.length > 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '12px',
            height: '160px',
            padding: '16px 0',
            borderBottom: 'var(--neo-border-4)'
          }}>
            {metrics.slice(-15).map((m, idx) => {
              const cpuHeight = Math.max(12, (m.cpu_usage_pct / 100) * 130);
              return (
                <div
                  key={m.id || idx}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    height: '100%'
                  }}
                  title={`Time: ${new Date(m.created_at).toLocaleTimeString()}\nCPU: ${m.cpu_usage_pct}%\nRSS: ${m.memory_rss_mb} MB`}
                >
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '36px',
                      height: `${cpuHeight}px`,
                      background: 'var(--neo-yellow)',
                      border: 'var(--neo-border-4)',
                      boxShadow: '3px 3px 0px #000'
                    }}
                  />
                  <div style={{ fontSize: '0.7rem', fontWeight: 900, marginTop: '8px' }} className="font-mono">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', fontWeight: 900 }}>
            NO TELEMETRY SAMPLES RECORDED YET.
          </div>
        )}
      </div>

      {/* Ingestion Token & Integration cURL */}
      <div className="neo-card-static">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Terminal size={20} strokeWidth={3} />
            <h3 style={{ fontSize: '1.2rem' }}>TELEMETRY INGESTION ENDPOINT & TOKEN</h3>
          </div>
          <button
            id="btn-copy-telemetry-token"
            onClick={handleCopyToken}
            className="btn-neo-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            {tokenCopied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} strokeWidth={3} />}
            <span>{tokenCopied ? 'TOKEN COPIED' : 'COPY INGESTION TOKEN'}</span>
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: '1.5', marginBottom: '14px' }}>
          Stream metrics into Dev Box from backend workers or microservices via HTTP POST:
        </p>

        <div className="neo-code-box">
          <code>
            curl -X POST http://localhost:5000/api/telemetry/ingest \<br />
            &nbsp;&nbsp;-H "x-telemetry-token: {appDetails?.telemetry_token || 'your_telemetry_token'}" \<br />
            &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
            &nbsp;&nbsp;-d '&#123; "memory_rss_mb": 154.2, "memory_heap_mb": 88.5, "cpu_usage_pct": 14.8, "db_active_connections": 6, "uptime_seconds": 86400 &#125;'
          </code>
        </div>
      </div>
    </div>
  );
}
