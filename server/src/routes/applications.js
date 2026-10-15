import express from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  uploadFileToStorage,
  getStorageDownloadUrl,
  deleteFileFromStorage
} from '../services/storage.js';
import {
  fetchApplicationsFromSupabase,
  saveApplicationToSupabase,
  deleteApplicationFromSupabase,
  saveRecordToSupabase,
  deleteRecordFromSupabase
} from '../services/supabase.js';

const router = express.Router();

/**
 * Get all applications or filter by projectId
 * GET /api/applications
 */
router.get('/', async (req, res) => {
  const { projectId } = req.query;
  const rawApps = await fetchApplicationsFromSupabase(projectId);

  const enriched = rawApps.map(app => {
    const deployments = db.data.application_deployments.filter(d => d.application_id === app.id);
    const healthChecks = db.data.health_checks.filter(h => h.application_id === app.id);
    const expirations = db.data.credential_expirations.filter(e => e.application_id === app.id);

    return {
      ...app,
      deployments,
      healthChecks,
      expirationsCount: expirations.length,
      currentStatus: healthChecks.some(h => h.current_status === 'down')
        ? 'down'
        : healthChecks.some(h => h.current_status === 'maintenance')
        ? 'maintenance'
        : healthChecks.length > 0
        ? 'healthy'
        : 'unknown'
    };
  });

  return res.json(enriched);
});

/**
 * Get specific application with all child assets
 * GET /api/applications/:id
 */
router.get('/:id', (req, res) => {
  const app = db.data.applications.find(a => a.id === req.params.id);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const project = db.data.projects.find(p => p.id === app.project_id);
  const deployments = db.data.application_deployments.filter(d => d.application_id === app.id);
  const links = db.data.application_links.filter(l => l.application_id === app.id);
  const healthChecks = db.data.health_checks.filter(h => h.application_id === app.id);
  const expirations = db.data.credential_expirations.filter(e => e.application_id === app.id);
  const recentTelemetry = db.data.application_telemetry
    .filter(t => t.application_id === app.id)
    .slice(-10);

  return res.json({
    ...app,
    project,
    deployments,
    links,
    healthChecks,
    expirations,
    recentTelemetry
  });
});

/**
 * Create new application
 * POST /api/applications
 */
router.post('/', requireAuth, async (req, res) => {
  const { project_id, name, description, repo_url } = req.body;
  if (!project_id || !name) {
    return res.status(400).json({ error: 'project_id and name are required' });
  }

  const projectExists = db.data.projects.some(p => p.id === project_id);
  if (!projectExists) {
    return res.status(404).json({ error: 'Target project does not exist' });
  }

  const now = new Date().toISOString();
  const telemetryToken = `tel_${crypto.randomBytes(24).toString('hex')}`;

  const newApp = {
    id: uuidv4(),
    project_id,
    name: name.trim(),
    description: description ? description.trim() : '',
    repo_url: repo_url ? repo_url.trim() : '',
    telemetry_token: telemetryToken,
    created_at: now,
    updated_at: now
  };

  const saved = await saveApplicationToSupabase(newApp);

  return res.status(201).json(saved);
});

/**
 * Update application
 * PUT /api/applications/:id
 */
router.put('/:id', requireAuth, async (req, res) => {
  const app = db.data.applications.find(a => a.id === req.params.id);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const { name, description, repo_url } = req.body;
  if (name) app.name = name.trim();
  if (description !== undefined) app.description = description.trim();
  if (repo_url !== undefined) app.repo_url = repo_url.trim();
  app.updated_at = new Date().toISOString();

  const saved = await saveApplicationToSupabase(app);

  return res.json(saved);
});

/**
 * Delete application
 * DELETE /api/applications/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const index = db.data.applications.findIndex(a => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Application not found' });
  }

  await deleteApplicationFromSupabase(id);
  db.data.application_deployments = db.data.application_deployments.filter(d => d.application_id !== id);
  db.data.configs_and_secrets = db.data.configs_and_secrets.filter(c => c.application_id !== id);
  db.data.credential_expirations = db.data.credential_expirations.filter(e => e.application_id !== id);
  db.data.application_links = db.data.application_links.filter(l => l.application_id !== id);
  db.data.health_checks = db.data.health_checks.filter(h => h.application_id !== id);
  db.data.application_telemetry = db.data.application_telemetry.filter(t => t.application_id !== id);
  if (db.data.application_files) {
    db.data.application_files = db.data.application_files.filter(f => f.application_id !== id);
  }

  db.save();
  return res.json({ success: true, message: 'Application deleted' });
});

/**
 * Add deployment URL to application
 * POST /api/applications/:id/deployments
 */
router.post('/:id/deployments', requireAuth, (req, res) => {
  const { environment, url } = req.body;
  if (!environment || !url) {
    return res.status(400).json({ error: 'environment and url are required' });
  }

  const app = db.data.applications.find(a => a.id === req.params.id);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const newDep = {
    id: uuidv4(),
    application_id: app.id,
    environment,
    url: url.trim(),
    created_at: new Date().toISOString()
  };

  db.data.application_deployments.push(newDep);
  db.save();
  saveRecordToSupabase('application_deployments', newDep);

  return res.status(201).json(newDep);
});

/**
 * Delete deployment URL
 * DELETE /api/applications/:id/deployments/:depId
 */
router.delete('/:id/deployments/:depId', requireAuth, (req, res) => {
  const depIndex = db.data.application_deployments.findIndex(
    d => d.id === req.params.depId && d.application_id === req.params.id
  );
  if (depIndex === -1) {
    return res.status(404).json({ error: 'Deployment not found' });
  }

  db.data.application_deployments.splice(depIndex, 1);
  db.save();
  deleteRecordFromSupabase('application_deployments', req.params.depId);

  return res.json({ success: true });
});

/**
 * List application auxiliary files
 * GET /api/applications/:id/files
 */
router.get('/:id/files', (req, res) => {
  if (!db.data.application_files) db.data.application_files = [];
  const files = db.data.application_files.filter(f => f.application_id === req.params.id);
  return res.json(files);
});

/**
 * Upload application auxiliary file (Supabase Storage with local fallback)
 * POST /api/applications/:id/files
 */
router.post('/:id/files', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!db.data.application_files) db.data.application_files = [];
    const app = db.data.applications.find(a => a.id === req.params.id);
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded in request payload' });
    }

    const { title, description } = req.body;
    const fileResult = await uploadFileToStorage({
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: `apps/${app.id}`
    });

    const newFile = {
      id: fileResult.fileId,
      application_id: app.id,
      project_id: app.project_id,
      title: title || req.file.originalname,
      description: description || '',
      file_name: req.file.originalname,
      storage_provider: 'supabase',
      bucket: fileResult.bucket,
      storage_path: fileResult.storagePath,
      file_size_bytes: fileResult.sizeBytes,
      mime_type: fileResult.mimeType,
      created_at: new Date().toISOString()
    };

    db.data.application_files.unshift(newFile);
    db.save();

    return res.status(201).json(newFile);
  } catch (err) {
    console.error('Application file upload error:', err);
    return res.status(500).json({ error: 'File upload failed', message: err.message });
  }
});

/**
 * Download signed URL for application file
 * GET /api/applications/:id/files/:fileId/download
 */
router.get('/:id/files/:fileId/download', requireAuth, async (req, res) => {
  if (!db.data.application_files) db.data.application_files = [];
  const file = db.data.application_files.find(f => f.id === req.params.fileId);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  const downloadInfo = await getStorageDownloadUrl(file);
  return res.json(downloadInfo);
});

/**
 * Delete application file
 * DELETE /api/applications/:id/files/:fileId
 */
router.delete('/:id/files/:fileId', requireAuth, async (req, res) => {
  if (!db.data.application_files) db.data.application_files = [];
  const index = db.data.application_files.findIndex(f => f.id === req.params.fileId);
  if (index === -1) {
    return res.status(404).json({ error: 'File not found' });
  }

  const [removedFile] = db.data.application_files.splice(index, 1);
  db.save();
  await deleteFileFromStorage(removedFile);

  return res.json({ success: true, message: 'File deleted successfully' });
});

export default router;
