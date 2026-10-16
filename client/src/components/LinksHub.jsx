import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import ConfirmModal from './ConfirmModal.jsx';
import { ExternalLink, Plus, Archive, RotateCcw, Trash2, Tag, Globe, RefreshCw, X } from 'lucide-react';

export default function LinksHub({ activeApplicationId, activeProjectId, hideHeader = false, customTitle = null }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Delete confirmation modal state
  const [linkToDelete, setLinkToDelete] = useState(null);
  const [deletingLink, setDeletingLink] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('Documentation');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchLinks = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    try {
      const res = await api.links.list({
        ...(activeApplicationId ? { applicationId: activeApplicationId } : {}),
        ...(activeProjectId && !activeApplicationId ? { projectId: activeProjectId } : {}),
        includeArchived: 'true'
      });
      setLinks(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load links:', err);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
    const interval = setInterval(() => fetchLinks(true), 10000);
    return () => clearInterval(interval);
  }, [activeApplicationId, activeProjectId]);

  const handleToggleArchive = async (id) => {
    try {
      const updated = await api.links.toggleArchive(id);
      setLinks(prev => prev.map(l => l.id === id ? updated : l));
    } catch (err) {
      alert(`Archive toggle failed: ${err.message}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!linkToDelete) return;
    setDeletingLink(true);
    try {
      await api.links.delete(linkToDelete.id);
      setLinks(prev => prev.filter(l => l.id !== linkToDelete.id));
      setLinkToDelete(null);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingLink(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title || !url) return;

    setSaving(true);
    try {
      await api.links.create({
        application_id: activeApplicationId || null,
        project_id: activeProjectId || null,
        title,
        url,
        category,
        notes
      });
      setTitle('');
      setUrl('');
      setNotes('');
      setIsAddOpen(false);
      fetchLinks();
    } catch (err) {
      alert(`Failed to create link: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const displayedLinks = links.filter(l => showArchived ? l.is_archived : !l.is_archived);

  const getCategoryBadgeClass = (cat) => {
    switch (cat?.toLowerCase()) {
      case 'monitoring': return 'neo-badge neo-badge-violet';
      case 'billing': return 'neo-badge neo-badge-red';
      case 'admin': return 'neo-badge neo-badge-yellow';
      default: return 'neo-badge neo-badge-green';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: hideHeader ? '1.25rem' : '2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
            {customTitle || (activeApplicationId ? 'Application Resource Links' : activeProjectId ? 'Project Resource Links' : 'Resource Links Hub')}
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={showArchived ? 'btn-neo-secondary' : 'btn-neo-outline'}
            style={{ padding: '7px 12px', fontSize: '0.8rem' }}
          >
            <Archive size={14} />
            <span>{showArchived ? 'Viewing Archived' : 'Show Archived'}</span>
          </button>

          <button
            id="btn-add-resource-link"
            onClick={() => setIsAddOpen(true)}
            className="btn-neo-primary"
            style={{ padding: '7px 14px', fontSize: '0.82rem' }}
          >
            <Plus size={15} />
            <span>Add Link</span>
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {displayedLinks.map(link => (
          <div key={link.id} className="neo-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '220px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span className={getCategoryBadgeClass(link.category)}>
                  {link.category}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleToggleArchive(link.id)}
                    className="btn-neo-outline"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    title={link.is_archived ? 'Restore link' : 'Archive link'}
                  >
                    {link.is_archived ? <RotateCcw size={13} /> : <Archive size={13} />}
                  </button>
                  <button
                    onClick={() => setLinkToDelete({ id: link.id, title: link.title })}
                    className="btn-neo-danger"
                    style={{ padding: '4px 8px' }}
                    title="Delete link"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <h4 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '8px', color: 'var(--neo-black)', textTransform: 'uppercase' }}>
                {link.title}
              </h4>

              {link.notes && (
                <p style={{ fontSize: '0.85rem', color: 'var(--neo-black)', opacity: 0.9, fontWeight: 600, lineHeight: '1.4', marginBottom: '16px', background: 'var(--neo-canvas)', border: '2px solid rgba(255,255,255,0.2)', padding: '8px 10px' }}>
                  {link.notes}
                </p>
              )}
            </div>

            <div style={{ paddingTop: '14px', borderTop: 'var(--neo-border-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <span className="font-mono" style={{ fontSize: '0.78rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px', color: 'var(--neo-black)', opacity: 0.75 }}>
                {link.url}
              </span>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="btn-neo-primary"
                style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none' }}
              >
                <span>Visit</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        ))}
      </div>

      {displayedLinks.length === 0 && !loading && (
        <div className="neo-card-yellow" style={{ padding: '48px', textAlign: 'center', fontWeight: 900, fontSize: '1.1rem' }}>
          NO {showArchived ? 'ARCHIVED' : 'ACTIVE'} LINKS REGISTERED FOR THIS WORKLOAD.
        </div>
      )}

      {/* Add Modal */}
      {isAddOpen && (
        <div className="neo-modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="neo-modal-header neo-modal-header-yellow" style={{ padding: '18px 24px', background: 'var(--neo-yellow)', borderBottom: 'var(--neo-border-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#000000' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Globe size={22} color="#000000" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#000000', margin: 0 }}>Add Resource Link</h3>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="btn-neo-outline" style={{ padding: '4px 8px' }}>
                <X size={16} strokeWidth={3} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Resource Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grafana Production APM"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="neo-input"
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Target Destination URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://grafana.internal.domain.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="neo-input font-mono"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Category Tag
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="neo-input"
                >
                  <option value="Documentation">Documentation</option>
                  <option value="Monitoring">Monitoring & APM</option>
                  <option value="Billing">Billing & SaaS</option>
                  <option value="Admin">Admin Portal</option>
                  <option value="Repository">Repository / VCS</option>
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Access Notes / Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Tailscale VPN required, production SSO credentials..."
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
                  {saving ? 'Creating Link...' : 'Create Resource Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(linkToDelete)}
        title="Delete Resource Link"
        message={`Are you sure you want to delete the link "${linkToDelete?.title}"?`}
        warningNote="This resource link reference will be permanently removed."
        confirmText="Yes, Delete Link"
        loading={deletingLink}
        onConfirm={handleConfirmDelete}
        onClose={() => setLinkToDelete(null)}
      />
    </div>
  );
}
