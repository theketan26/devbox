import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  uploadFileToStorage,
  getStorageDownloadUrl,
  deleteFileFromStorage
} from '../services/storage.js';
import {
  fetchProjectsFromSupabase,
  saveProjectToSupabase,
  deleteProjectFromSupabase,
  getSupabaseStatus,
  saveRecordToSupabase,
  deleteRecordFromSupabase
} from '../services/supabase.js';

const router = express.Router();

/**
 * Get Supabase DB sync status
 * GET /api/projects/supabase-status
 */
router.get('/supabase-status', async (req, res) => {
  const status = await getSupabaseStatus();
  return res.json(status);
});

/**
 * List all projects with nested statistics
 * GET /api/projects
 */
router.get('/', async (req, res) => {
  // Sync with Supabase DB
  const rawProjects = await fetchProjectsFromSupabase();

  const projects = rawProjects.map(p => {
    const apps = db.data.applications.filter(a => a.project_id === p.id);
    const appIds = new Set(apps.map(a => a.id));
    const configs = db.data.configs_and_secrets.filter(
      c => c.project_id === p.id || appIds.has(c.application_id)
    );
    const healthChecks = db.data.health_checks.filter(h => appIds.has(h.application_id));
    const files = db.data.project_files.filter(f => f.project_id === p.id);

    return {
      ...p,
      applications: apps,
      applicationsCount: apps.length,
      configsCount: configs.length,
      healthChecksCount: healthChecks.length,
      filesCount: files.length,
      healthyCount: healthChecks.filter(h => h.current_status === 'healthy').length,
      downCount: healthChecks.filter(h => h.current_status === 'down').length
    };
  });

  return res.json(projects);
});

/**
 * Get project details
 * GET /api/projects/:id
 */
router.get('/:id', (req, res) => {
  const project = db.data.projects.find(p => p.id === req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const applications = db.data.applications.filter(a => a.project_id === project.id);
  const files = db.data.project_files.filter(f => f.project_id === project.id);

  return res.json({
    ...project,
    applications,
    files
  });
});

/**
 * Create new project
 * POST /api/projects
 */
router.post('/', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const now = new Date().toISOString();
  const newProject = {
    id: uuidv4(),
    name: name.trim(),
    description: description ? description.trim() : '',
    created_at: now,
    updated_at: now
  };

  // Persist to Supabase DB and local store
  const saved = await saveProjectToSupabase(newProject);

  return res.status(201).json(saved);
});

/**
 * Update project
 * PUT /api/projects/:id
 */
router.put('/:id', requireAuth, async (req, res) => {
  const project = db.data.projects.find(p => p.id === req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const { name, description } = req.body;
  if (name) project.name = name.trim();
  if (description !== undefined) project.description = description.trim();
  project.updated_at = new Date().toISOString();

  // Persist update to Supabase DB
  const saved = await saveProjectToSupabase(project);

  return res.json(saved);
});

/**
 * Delete project with cascading
 * DELETE /api/projects/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const index = db.data.projects.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Find all child applications to cascade delete
  const childApps = db.data.applications.filter(a => a.project_id === id);
  const childAppIds = new Set(childApps.map(a => a.id));

  // Cascades
  await deleteProjectFromSupabase(id);
  db.data.applications = db.data.applications.filter(a => a.project_id !== id);
  db.data.application_deployments = db.data.application_deployments.filter(
    d => !childAppIds.has(d.application_id)
  );
  db.data.configs_and_secrets = db.data.configs_and_secrets.filter(
    c => c.project_id !== id && !childAppIds.has(c.application_id)
  );
  db.data.credential_expirations = db.data.credential_expirations.filter(
    e => !childAppIds.has(e.application_id)
  );
  db.data.application_links = db.data.application_links.filter(
    l => l.project_id !== id && !childAppIds.has(l.application_id)
  );
  db.data.health_checks = db.data.health_checks.filter(
    h => !childAppIds.has(h.application_id)
  );
  db.data.project_files = db.data.project_files.filter(f => f.project_id !== id);
  if (db.data.application_files) {
    db.data.application_files = db.data.application_files.filter(f => !childAppIds.has(f.application_id));
  }

  db.save();
  return res.json({ success: true, message: 'Project and associated resources deleted' });
});

/**
 * List project files
 * GET /api/projects/:id/files
 */
router.get('/:id/files', (req, res) => {
  const files = db.data.project_files.filter(f => f.project_id === req.params.id);
  return res.json(files);
});

/**
 * Upload project file (Supabase Storage with local fallback)
 * POST /api/projects/:id/files
 */
router.post('/:id/files', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const project = db.data.projects.find(p => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded in request payload' });
    }

    const { title, description } = req.body;
    const fileResult = await uploadFileToStorage({
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: `projects/${project.id}`
    });

    const newFile = {
      id: fileResult.fileId,
      project_id: project.id,
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

    if (!db.data.project_files) db.data.project_files = [];
    db.data.project_files.unshift(newFile);
    db.save();
    saveRecordToSupabase('project_files', newFile);

    return res.status(201).json(newFile);
  } catch (err) {
    console.error('Project file upload error:', err);
    return res.status(500).json({ error: 'File upload failed', message: err.message });
  }
});

/**
 * Download signed URL / file info
 * GET /api/projects/:id/files/:fileId/download
 */
router.get('/:id/files/:fileId/download', requireAuth, async (req, res) => {
  if (!db.data.project_files) db.data.project_files = [];
  const file = db.data.project_files.find(f => f.id === req.params.fileId);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const downloadInfo = await getStorageDownloadUrl(file);
    return res.json(downloadInfo);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate signed URL', message: err.message });
  }
});

/**
 * Direct file stream / download endpoint (redirects to Supabase signed URL)
 * GET /api/projects/files/download/:fileId
 */
router.get('/files/download/:fileId', async (req, res) => {
  const file = (db.data.project_files || []).find(f => f.id === req.params.fileId) ||
               (db.data.application_files || []).find(f => f.id === req.params.fileId);
  if (!file) {
    return res.status(404).send('File not found');
  }

  try {
    const downloadInfo = await getStorageDownloadUrl(file);
    if (downloadInfo?.downloadUrl) {
      return res.redirect(downloadInfo.downloadUrl);
    }
    return res.status(404).send('Download URL could not be resolved');
  } catch (err) {
    return res.status(500).send(`Download error: ${err.message}`);
  }
});

/**
 * Delete project file
 * DELETE /api/projects/:id/files/:fileId
 */
router.delete('/:id/files/:fileId', requireAuth, async (req, res) => {
  if (!db.data.project_files) db.data.project_files = [];
  const index = db.data.project_files.findIndex(f => f.id === req.params.fileId);
  if (index === -1) {
    return res.status(404).json({ error: 'File not found' });
  }

  const [removedFile] = db.data.project_files.splice(index, 1);
  db.save();
  deleteRecordFromSupabase('project_files', req.params.fileId);
  await deleteFileFromStorage(removedFile);

  return res.json({ success: true, message: 'File deleted successfully' });
});

export default router;
