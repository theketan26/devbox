import express from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  uploadFileToStorage,
  getStorageDownloadUrl,
  deleteFileFromStorage
} from '../services/storage.js';
import { getSupabase } from '../services/supabase.js';

const router = express.Router();

/**
 * Get all applications directly from Supabase DB
 * GET /api/applications
 */
router.get('/', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const { projectId } = req.query;

  try {
    let appQuery = client.from('applications').select('*').order('created_at', { ascending: false });
    if (projectId) {
      appQuery = appQuery.eq('project_id', projectId);
    }

    const [
      { data: rawApps, error: aErr },
      { data: allDeps, error: dErr },
      { data: allHealthChecks, error: hErr },
      { data: allExpirations, error: eErr }
    ] = await Promise.all([
      appQuery,
      client.from('application_deployments').select('*'),
      client.from('health_checks').select('*'),
      client.from('credential_expirations').select('*')
    ]);

    if (aErr) throw aErr;

    const apps = rawApps || [];
    const deployments = allDeps || [];
    const healthChecks = allHealthChecks || [];
    const expirations = allExpirations || [];

    const enriched = apps.map(app => {
      const appDeps = deployments.filter(d => d.application_id === app.id);
      const appChecks = healthChecks.filter(h => h.application_id === app.id);
      const appExpirations = expirations.filter(e => e.application_id === app.id);

      return {
        ...app,
        deployments: appDeps,
        healthChecks: appChecks,
        expirationsCount: appExpirations.length,
        currentStatus: appChecks.some(h => h.current_status === 'down')
          ? 'down'
          : appChecks.some(h => h.current_status === 'maintenance')
          ? 'maintenance'
          : appChecks.length > 0
          ? 'healthy'
          : 'unknown'
      };
    });

    return res.json(enriched);
  } catch (err) {
    console.error('[Supabase DB] Error fetching applications:', err.message);
    return res.status(500).json({ error: 'Failed to fetch applications from database', message: err.message });
  }
});

/**
 * Get specific application with all child assets directly from Supabase DB
 * GET /api/applications/:id
 */
router.get('/:id', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data: app, error: appErr } = await client
      .from('applications')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (appErr || !app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const [
      { data: project },
      { data: deployments },
      { data: links },
      { data: healthChecks },
      { data: expirations },
      { data: recentTelemetry }
    ] = await Promise.all([
      client.from('projects').select('*').eq('id', app.project_id).single(),
      client.from('application_deployments').select('*').eq('application_id', app.id),
      client.from('application_links').select('*').eq('application_id', app.id),
      client.from('health_checks').select('*').eq('application_id', app.id),
      client.from('credential_expirations').select('*').eq('application_id', app.id),
      client.from('application_telemetry').select('*').eq('application_id', app.id).order('created_at', { ascending: false }).limit(10)
    ]);

    return res.json({
      ...app,
      project: project || null,
      deployments: deployments || [],
      links: links || [],
      healthChecks: healthChecks || [],
      expirations: expirations || [],
      recentTelemetry: (recentTelemetry || []).reverse()
    });
  } catch (err) {
    console.error('[Supabase DB] Error fetching application details:', err.message);
    return res.status(500).json({ error: 'Failed to fetch application from database', message: err.message });
  }
});

/**
 * Create new application directly in Supabase DB
 * POST /api/applications
 */
router.post('/', requireAuth, async (req, res) => {
  const { project_id, name, description, repo_url } = req.body;
  if (!project_id || !name) {
    return res.status(400).json({ error: 'project_id and name are required' });
  }

  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data: project } = await client.from('projects').select('id').eq('id', project_id).single();
    if (!project) {
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

    const { data, error } = await client
      .from('applications')
      .insert(newApp)
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data || newApp);
  } catch (err) {
    console.error('[Supabase DB] Error creating application:', err.message);
    return res.status(500).json({ error: 'Failed to create application in database', message: err.message });
  }
});

/**
 * Update application directly in Supabase DB
 * PUT /api/applications/:id
 */
router.put('/:id', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const { name, description, repo_url } = req.body;
  const updatePayload = { updated_at: new Date().toISOString() };
  if (name !== undefined) updatePayload.name = name.trim();
  if (description !== undefined) updatePayload.description = description.trim();
  if (repo_url !== undefined) updatePayload.repo_url = repo_url.trim();

  try {
    const { data, error } = await client
      .from('applications')
      .update(updatePayload)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Application not found or update failed' });
    }

    return res.json(data);
  } catch (err) {
    console.error('[Supabase DB] Error updating application:', err.message);
    return res.status(500).json({ error: 'Failed to update application in database', message: err.message });
  }
});

/**
 * Delete application directly from Supabase DB (cascades via FKs)
 * DELETE /api/applications/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { error } = await client
      .from('applications')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    return res.json({ success: true, message: 'Application deleted from database' });
  } catch (err) {
    console.error('[Supabase DB] Error deleting application:', err.message);
    return res.status(500).json({ error: 'Failed to delete application from database', message: err.message });
  }
});

/**
 * Add deployment URL to application directly in Supabase DB
 * POST /api/applications/:id/deployments
 */
router.post('/:id/deployments', requireAuth, async (req, res) => {
  const { environment, url } = req.body;
  if (!environment || !url) {
    return res.status(400).json({ error: 'environment and url are required' });
  }

  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const newDep = {
      id: uuidv4(),
      application_id: req.params.id,
      environment,
      url: url.trim(),
      created_at: new Date().toISOString()
    };

    const { data, error } = await client
      .from('application_deployments')
      .insert(newDep)
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data || newDep);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create deployment in database', message: err.message });
  }
});

/**
 * Delete deployment URL directly from Supabase DB
 * DELETE /api/applications/:id/deployments/:depId
 */
router.delete('/:id/deployments/:depId', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { error } = await client
      .from('application_deployments')
      .delete()
      .eq('id', req.params.depId);

    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete deployment', message: err.message });
  }
});

/**
 * List application auxiliary files directly from Supabase DB
 * GET /api/applications/:id/files
 */
router.get('/:id/files', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data, error } = await client
      .from('application_files')
      .select('*')
      .eq('application_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list application files', message: err.message });
  }
});

/**
 * Upload application auxiliary file directly to Supabase Storage and application_files table
 * POST /api/applications/:id/files
 */
router.post('/:id/files', requireAuth, upload.single('file'), async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data: app } = await client
      .from('applications')
      .select('id, project_id, name')
      .eq('id', req.params.id)
      .single();

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
      storage_path: fileResult.storagePath,
      file_size_bytes: fileResult.sizeBytes,
      mime_type: fileResult.mimeType,
      created_at: new Date().toISOString()
    };

    const { data: inserted, error: insErr } = await client
      .from('application_files')
      .insert(newFile)
      .select()
      .single();

    if (insErr) throw insErr;
    return res.status(201).json(inserted || newFile);
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
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data: file, error } = await client
      .from('application_files')
      .select('*')
      .eq('id', req.params.fileId)
      .single();

    if (error || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const downloadInfo = await getStorageDownloadUrl(file);
    return res.json(downloadInfo);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate download URL', message: err.message });
  }
});

/**
 * Delete application file from storage and database
 * DELETE /api/applications/:id/files/:fileId
 */
router.delete('/:id/files/:fileId', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data: file } = await client
      .from('application_files')
      .select('*')
      .eq('id', req.params.fileId)
      .single();

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await deleteFileFromStorage(file);
    await client.from('application_files').delete().eq('id', req.params.fileId);

    return res.json({ success: true, message: 'File deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete file', message: err.message });
  }
});

export default router;
