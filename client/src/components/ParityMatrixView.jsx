import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Layers } from 'lucide-react';

export default function ParityMatrixView({ projectId, applicationId }) {
  const [parityData, setParityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterIssuesOnly, setFilterIssuesOnly] = useState(false);

  const fetchParity = async () => {
    setLoading(true);
    try {
      const res = await api.configs.getParity({
        projectId: projectId || undefined,
        applicationId: applicationId || undefined
      });
      setParityData(res);
    } catch (err) {
      console.error('Failed to load parity matrix:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParity();
  }, [projectId, applicationId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', fontWeight: 900 }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} strokeWidth={3} />
        <span>AUDITING CROSS-ENVIRONMENT PARITY...</span>
      </div>
    );
  }

  const matrix = parityData?.matrix || [];
  const displayMatrix = filterIssuesOnly ? matrix.filter(m => !m.hasParity) : matrix;
  const summary = parityData?.summary || { totalKeys: 0, inParityCount: 0, parityPercentage: 100, missingCount: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Parity Health Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
        <div className="neo-card-yellow">
          <div style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>PARITY SYNC SCORE</div>
          <div style={{ fontSize: '2.8rem', fontWeight: 900, marginTop: '4px', lineHeight: 1 }}>
            {summary.parityPercentage}%
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 900, marginTop: '8px', borderTop: '2px solid rgba(255,255,255,0.2)', paddingTop: '6px' }}>
            {summary.inParityCount} OF {summary.totalKeys} KEYS FULLY SYNCHRONIZED
          </div>
        </div>

        <div className="neo-card-red">
          <div style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>MISSING IN PRODUCTION</div>
          <div style={{ fontSize: '2.8rem', fontWeight: 900, marginTop: '4px', lineHeight: 1 }}>
            {summary.missingCount}
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 900, marginTop: '8px', borderTop: '2px solid rgba(255,255,255,0.2)', paddingTop: '6px' }}>
            ORPHANED OR UNCONFIGURED FOR DEPLOYMENT
          </div>
        </div>

        <div className="neo-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}>
          <button
            onClick={() => setFilterIssuesOnly(!filterIssuesOnly)}
            className={filterIssuesOnly ? 'btn-neo-primary' : 'btn-neo-secondary'}
            style={{ width: '100%', fontSize: '0.84rem' }}
          >
            {filterIssuesOnly ? 'SHOWING DISCREPANCIES ONLY' : 'FILTER DISCREPANCIES ONLY'}
          </button>
          <button
            onClick={fetchParity}
            className="btn-neo-outline"
            style={{ width: '100%', fontSize: '0.84rem' }}
          >
            <RefreshCw size={14} strokeWidth={3} />
            <span>RE-RUN PARITY AUDIT</span>
          </button>
        </div>
      </div>

      {/* Parity Table */}
      <div className="neo-card-static" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="neo-table">
            <thead>
              <tr>
                <th>Variable Key</th>
                <th>Development</th>
                <th>Staging</th>
                <th>Production</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayMatrix.map(row => (
                <tr key={row.key}>
                  <td>
                    <code className="font-mono" style={{ fontWeight: 900, fontSize: '0.92rem' }}>
                      {row.key}
                    </code>
                  </td>

                  {/* Development */}
                  <td>
                    {row.environments.development?.exists ? (
                      <span className="neo-badge neo-badge-green" style={{ fontSize: '0.7rem' }}>
                        <CheckCircle2 size={13} strokeWidth={3} /> PRESENT
                      </span>
                    ) : (
                      <span className="neo-badge neo-badge-white" style={{ fontSize: '0.7rem' }}>
                        <XCircle size={13} strokeWidth={3} /> MISSING
                      </span>
                    )}
                  </td>

                  {/* Staging */}
                  <td>
                    {row.environments.staging?.exists ? (
                      <span className="neo-badge neo-badge-green" style={{ fontSize: '0.7rem' }}>
                        <CheckCircle2 size={13} strokeWidth={3} /> PRESENT
                      </span>
                    ) : (
                      <span className="neo-badge neo-badge-yellow" style={{ fontSize: '0.7rem' }}>
                        <XCircle size={13} strokeWidth={3} /> MISSING
                      </span>
                    )}
                  </td>

                  {/* Production */}
                  <td>
                    {row.environments.production?.exists ? (
                      <span className="neo-badge neo-badge-green" style={{ fontSize: '0.7rem' }}>
                        <CheckCircle2 size={13} strokeWidth={3} /> PRESENT
                      </span>
                    ) : (
                      <span className="neo-badge neo-badge-red" style={{ fontSize: '0.7rem' }}>
                        <AlertTriangle size={13} strokeWidth={3} /> MISSING
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td>
                    {row.hasParity ? (
                      <span className="neo-badge neo-badge-green">SYNCED</span>
                    ) : (
                      <span className="neo-badge neo-badge-red">
                        MISSING: {row.missingIn.join(', ').toUpperCase()}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
