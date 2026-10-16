import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api.js';
import ConfirmModal from './ConfirmModal.jsx';
import {
  FileText,
  Plus,
  Download,
  HardDrive,
  RefreshCw,
  X,
  Check,
  Shield,
  Trash2,
  Cloud,
  Upload,
  ExternalLink
} from 'lucide-react';

export default function ApplicationFilesManager({ applicationId, applicationName }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [signedUrlData, setSignedUrlData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Delete confirmation modal state
  const [fileToDelete, setFileToDelete] = useState(null);
  const [deletingFile, setDeletingFile] = useState(false);

  // Upload Form
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchFiles = async (isPoll = false) => {
    if (!applicationId) return;
    if (!isPoll) setLoading(true);
    try {
      const res = await api.applications.listFiles(applicationId);
      setFiles(res || []);
    } catch (err) {
      console.error('Failed to load application files:', err);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    const interval = setInterval(() => fetchFiles(true), 10000);
    return () => clearInterval(interval);
  }, [applicationId]);

  const handleDownload = async (fileId) => {
    try {
      const res = await api.applications.getDownloadUrl(applicationId, fileId);
      setSignedUrlData(res);
      setCopied(false);
    } catch (err) {
      alert(`Download link error: ${err.message}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setDeletingFile(true);
    try {
      await api.applications.deleteFile(applicationId, fileToDelete.id);
      setFiles(prev => prev.filter(f => f.id !== fileToDelete.id));
      setFileToDelete(null);
    } catch (err) {
      alert(`Failed to delete file: ${err.message}`);
    } finally {
      setDeletingFile(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name);
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', title || selectedFile.name);
      formData.append('description', description);

      await api.applications.uploadFile(applicationId, formData);
      setIsUploadOpen(false);
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchFiles();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase' }}>
            Application Files & Certificates
          </h3>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, opacity: 0.8, marginTop: '2px' }}>
            Direct Supabase Storage integration for {applicationName || 'Application'} assets
          </div>
        </div>

        <button
          id="btn-upload-app-file"
          onClick={() => {
            setSelectedFile(null);
            setTitle('');
            setDescription('');
            setIsUploadOpen(true);
          }}
          className="btn-neo-cyan"
        >
          <Upload size={15} strokeWidth={3} />
          <span>Upload File to Supabase</span>
        </button>
      </div>

      {/* Table Card */}
      <div className="neo-card-static" style={{ padding: 0, overflowX: 'auto' }}>
        {files.length > 0 ? (
          <table className="neo-table">
            <thead>
              <tr>
                <th>Document / Asset</th>
                <th>Storage Provider & Path</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => {
                const isSupabase = f.storage_provider === 'supabase';

                return (
                  <tr key={f.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: isSupabase ? 'var(--neo-cyan)' : 'var(--neo-yellow)', border: '2px solid #000', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={18} color="#000" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, color: 'var(--neo-black)', fontSize: '0.95rem' }}>{f.title}</div>
                          <div className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--neo-black)', opacity: 0.75 }}>{f.file_name}</div>
                          {f.description && (
                            <div style={{ fontSize: '0.76rem', color: 'var(--neo-black)', opacity: 0.7, marginTop: '2px' }}>{f.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="neo-badge neo-badge-cyan font-mono" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Cloud size={11} />
                          <span>SUPABASE ({f.bucket || 'devbox-files'})</span>
                        </span>
                        <code className="font-mono" style={{ fontSize: '0.76rem', background: 'var(--neo-canvas)', border: '2px solid rgba(255,255,255,0.2)', padding: '2px 6px', fontWeight: 700 }} title={f.storage_path}>
                          {f.storage_path.length > 32 ? f.storage_path.slice(0, 32) + '...' : f.storage_path}
                        </code>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {f.file_size_bytes > 1024 * 1024
                        ? `${(f.file_size_bytes / (1024 * 1024)).toFixed(2)} MB`
                        : `${(f.file_size_bytes / 1024).toFixed(1)} KB`}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {new Date(f.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => handleDownload(f.id)}
                          className="btn-neo-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.76rem' }}
                          title="Generate temporary signed download link"
                        >
                          <Download size={13} />
                          <span>Download</span>
                        </button>
                        <button
                          onClick={() => setFileToDelete({ id: f.id, title: f.title || f.file_name })}
                          className="btn-neo-danger"
                          style={{ padding: '6px 10px', fontSize: '0.76rem' }}
                          title="Delete file from storage"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="neo-card-cyan" style={{ textAlign: 'center', padding: '40px', fontWeight: 900, margin: '16px' }}>
            NO APPLICATION AUXILIARY ASSETS UPLOADED YET. CLICK "UPLOAD FILE TO SUPABASE" TO ADD CERTIFICATES OR ASSETS.
          </div>
        )}
      </div>

      {/* Signed URL Result Modal */}
      {signedUrlData && (
        <div className="neo-modal-overlay" onClick={() => setSignedUrlData(null)}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="neo-modal-header neo-modal-header-green" style={{ padding: '18px 24px', background: 'var(--neo-green)', borderBottom: 'var(--neo-border-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#000000' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={22} color="#000" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#000000', margin: 0 }}>Signed Download URL Generated</h3>
              </div>
              <button
                onClick={() => setSignedUrlData(null)}
                className="btn-neo-outline"
                style={{ padding: '4px 8px', background: '#000000', color: '#FFFFFF', border: '2px solid #000000' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '14px', color: 'var(--neo-black)' }}>
                Temporary download link for <strong>{signedUrlData.fileName}</strong> (Storage: {signedUrlData.provider.toUpperCase()}):
              </p>

              <div className="neo-code-box font-mono" style={{ wordBreak: 'break-all', marginBottom: '24px', fontSize: '0.78rem', lineHeight: '1.5', maxHeight: '120px', overflowY: 'auto' }}>
                {signedUrlData.downloadUrl}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                <a
                  href={signedUrlData.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-neo-outline"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <ExternalLink size={14} />
                  <span>Open Directly</span>
                </a>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(signedUrlData.downloadUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="btn-neo-secondary"
                >
                  {copied ? <Check size={14} /> : null}
                  <span>{copied ? 'Copied' : 'Copy Signed URL'}</span>
                </button>
                <button
                  onClick={() => setSignedUrlData(null)}
                  className="btn-neo-primary"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {isUploadOpen && (
        <div className="neo-modal-overlay" onClick={() => setIsUploadOpen(false)}>
          <div className="neo-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="neo-modal-header neo-modal-header-cyan" style={{ padding: '18px 24px', background: 'var(--neo-cyan)', borderBottom: 'var(--neo-border-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#000000' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <HardDrive size={22} color="#000" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#000000', margin: 0 }}>Upload Application File</h3>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="btn-neo-outline"
                style={{ padding: '4px 8px', background: '#000000', color: '#FFFFFF', border: '2px solid #000000' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
                  Select File from Computer
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  onChange={handleFileChange}
                  className="neo-input"
                  style={{ padding: '10px' }}
                />
                {selectedFile && (
                  <div style={{ marginTop: '6px', fontSize: '0.78rem', fontWeight: 800, opacity: 0.85 }}>
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Document / Asset Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production SSL Certificate / Architecture Diagram"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="neo-input"
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Description / Specification (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Auxiliary notes, bundle specs, or deployment keys..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="neo-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsUploadOpen(false)} className="btn-neo-outline">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="btn-neo-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Uploading to Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Upload & Store</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(fileToDelete)}
        title="Delete Application File"
        message={`Are you sure you want to permanently delete "${fileToDelete?.title}" from storage?`}
        warningNote="The file object in storage and its metadata will be permanently removed."
        confirmText="Yes, Delete File"
        loading={deletingFile}
        onConfirm={handleConfirmDelete}
        onClose={() => setFileToDelete(null)}
      />
    </div>
  );
}
