import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { ShieldAlert, Plus, Trash2, Calendar, AlertTriangle, CheckCircle, RefreshCw, Zap } from 'lucide-react';

export default function ExpirationsTracker({ activeApplicationId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [credentialType, setCredentialType] = useState('ssl_cert');
  const [expiresAt, setExpiresAt] = useState('');
  const [alertDaysBefore, setAlertDaysBefore] = useState(14);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchExpirations = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    try {
      const res = await api.expirations.list(activeApplicationId || undefined);
      setItems(res);
    } catch (err) {
      console.error('Failed to load expirations:', err);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpirations();
    const interval = setInterval(() => fetchExpirations(true), 10000);
    return () => clearInterval(interval);
  }, [activeApplicationId]);

  const handleDelete = async (id, itemName) => {
    if (!window.confirm(`Delete expiration tracker for ${itemName}?`)) return;
    try {
      await api.expirations.delete(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name || !expiresAt) return;

    setSaving(true);
    try {
      const appId = activeApplicationId || (items[0]?.application_id || 'default');
      await api.expirations.create({
        application_id: appId,
        name,
        credential_type: credentialType,
        expires_at: expiresAt,
        alert_days_before: Number(alertDaysBefore),
        notes
      });
      setName('');
      setExpiresAt('');
      setNotes('');
      setIsAddOpen(false);
      fetchExpirations();
    } catch (err) {
      alert(`Failed to add expiration: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--neo-red)',
            border: 'var(--neo-border-2)',
            boxShadow: '3px 3px 0px #000',
            padding: '3px 8px',
            fontWeight: 900,
            fontSize: '0.74rem',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>
            <ShieldAlert size={14} strokeWidth={3} />
            <span>Deadline Monitoring</span>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900 }}>
            CREDENTIAL & EXPIRATION TRACKER
          </h1>
          <p style={{ color: 'var(--neo-black)', opacity: 0.75, fontSize: '0.95rem', marginTop: '6px', fontWeight: 700 }}>
            Track SSL certificates, SaaS API keys, and domains before deadlines trigger production outages.
          </p>
        </div>

        <button
          id="btn-add-expiration"
          onClick={() => setIsAddOpen(true)}
          className="btn-neo-primary"
        >
          <Plus size={16} strokeWidth={3} />
          <span>Track Expiration</span>
        </button>
      </div>

      <div className="neo-card-static" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', fontWeight: 900 }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} strokeWidth={3} />
            <span>CALCULATING CREDENTIAL DEADLINES...</span>
          </div>
        ) : items.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="neo-table">
              <thead>
                <tr>
                  <th>Credential / Domain</th>
                  <th>Type</th>
                  <th>Expiration Date</th>
                  <th>Remaining</th>
                  <th>Urgency</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isCritical = item.status === 'CRITICAL' || item.status === 'EXPIRED';
                  const isWarning = item.status === 'WARNING';

                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 900, fontSize: '0.95rem' }}>{item.name}</div>
                        {item.notes && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--neo-black)', opacity: 0.7, marginTop: '2px' }}>{item.notes}</div>
                        )}
                      </td>
                      <td>
                        <span className="neo-badge neo-badge-violet" style={{ fontSize: '0.7rem' }}>
                          {item.credential_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="font-mono" style={{ fontSize: '0.88rem' }}>
                        {new Date(item.expires_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td>
                        <span className="font-mono" style={{ fontWeight: 900, fontSize: '1.05rem', color: isCritical ? '#E11D48' : isWarning ? '#D97706' : '#16A34A' }}>
                          {item.daysRemaining <= 0 ? 'EXPIRED' : `${item.daysRemaining} DAYS`}
                        </span>
                      </td>
                      <td>
                        <span className={`neo-badge ${isCritical ? 'neo-badge-red' : isWarning ? 'neo-badge-yellow' : 'neo-badge-green'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="btn-neo-danger"
                          style={{ padding: '5px 10px' }}
                        >
                          <Trash2 size={13} strokeWidth={3} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '50px', fontWeight: 900 }}>
            NO CREDENTIAL DEADLINES RECORDED.
          </div>
        )}
      </div>

      {/* Add Modal */}
      {isAddOpen && (
        <div className="neo-modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="neo-modal-header neo-modal-header-red" style={{ padding: '20px 24px', borderBottom: 'var(--neo-border-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--neo-red)', color: '#000000' }}>
              <h3 style={{ fontSize: '1.25rem', color: '#000000', margin: 0, fontWeight: 900 }}>TRACK CREDENTIAL EXPIRATION</h3>
              <button onClick={() => setIsAddOpen(false)} className="btn-neo-outline" style={{ padding: '4px 8px' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, marginBottom: '6px' }}>
                  CREDENTIAL / SERVICE NAME
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. *.apexcommerce.io SSL Wildcard"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="neo-input"
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, marginBottom: '6px' }}>
                    TYPE
                  </label>
                  <select
                    value={credentialType}
                    onChange={(e) => setCredentialType(e.target.value)}
                    className="neo-input font-mono"
                  >
                    <option value="ssl_cert">SSL CERTIFICATE</option>
                    <option value="api_token">API TOKEN</option>
                    <option value="domain">DOMAIN NAME</option>
                    <option value="saas_key">SAAS KEY</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, marginBottom: '6px' }}>
                    ALERT DAYS AHEAD
                  </label>
                  <input
                    type="number"
                    value={alertDaysBefore}
                    onChange={(e) => setAlertDaysBefore(e.target.value)}
                    className="neo-input font-mono"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, marginBottom: '6px' }}>
                  EXPIRATION DATE
                </label>
                <input
                  type="date"
                  required
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="neo-input font-mono"
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, marginBottom: '6px' }}>
                  RENEWAL NOTES
                </label>
                <textarea
                  rows={2}
                  placeholder="Renewal dashboard link, provider account credentials..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="neo-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn-neo-outline">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-neo-primary"
                >
                  {saving ? 'Saving...' : 'Start Tracking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
