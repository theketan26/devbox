import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '../services/api.js';
import { addProject } from '../store/projectsSlice.js';
import { FolderPlus, X } from 'lucide-react';

export default function NewProjectModal({ onClose }) {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const created = await api.projects.create({
        name: name.trim(),
        description: description.trim()
      });
      dispatch(addProject(created));
      onClose();
    } catch (err) {
      alert(`Failed to create project: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="neo-modal-overlay" onClick={onClose}>
      <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="neo-modal-header neo-modal-header-yellow" style={{ padding: '18px 24px', background: 'var(--neo-yellow)', color: '#000000', borderBottom: 'var(--neo-border-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderPlus size={22} color="#000" strokeWidth={2.5} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', color: '#000000', margin: 0 }}>Create Project</h3>
          </div>
          <button onClick={onClose} className="btn-neo-outline" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
              Project Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Nexus Core Infrastructure"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="neo-input"
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
              Project Description
            </label>
            <textarea
              rows={3}
              placeholder="Primary microservices, shared repositories, and cloud workloads..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="neo-input"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn-neo-outline">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-neo-primary"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
