import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  uploadFileToStorage,
  getStorageDownloadUrl,
  deleteFileFromStorage
} from '../services/storage.js';
import {
  getSupabase,
  getSupabaseStatus
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
 * List all projects with nested statistics directly from Supabase DB
 * GET /api/projects
 */
router.get('/', async (req, res) => {
  const client = getSupabase();
  if (!client) {
    return res.status(500).json({ error: 'Database client not initialized' });
  }

  try {
    const [
      { data: rawProjects, error: pErr },
      { data: allApps, error: aErr },
      { data: allConfigs, error: cErr },
      { data: allHealthChecks, error: hErr },
      { data: allFiles, error: fErr }
    ] = await Promise.all([
      client.from('projects').select('*').order('created_at', { ascending: false }),
      client.from('applications').select('*'),
      client.from('configs_and_secrets').select('*'),
      client.from('health_checks').select('*'),
      client.from('project_files').select('*')
    ]);

    if (pErr) throw pErr;

    const apps = allApps || [];
    const configs = allConfigs || [];
    const healthChecks = allHealthChecks || [];
    const files = allFiles || [];

    const projects = (rawProjects || []).map(p => {
      const projApps = apps.filter(a => a.project_id === p.id);
      const appIds = new Set(projApps.map(a => a.id));
      const projConfigs = configs.filter(
        c => c.project_id === p.id || appIds.has(c.application_id)
      );
      const projHealthChecks = healthChecks.filter(h => appIds.has(h.application_id));
      const projFiles = files.filter(f => f.project_id === p.id);

      return {
        ...p,
        applications: projApps,
        applicationsCount: projApps.length,
        configsCount: projConfigs.length,
        healthChecksCount: projHealthChecks.length,
        filesCount: projFiles.length,
        healthyCount: projHealthChecks.filter(h => h.current_status === 'healthy').length,
        downCount: projHealthChecks.filter(h => h.current_status === 'down').length
      };
    });

    return res.json(projects);
  } catch (err) {
    console.error('[Supabase DB] Error fetching projects:', err.message);
    return res.status(500).json({ error: 'Failed to fetch projects from database', message: err.message });
  }
});

/**
 * Get project details directly from Supabase DB
 * GET /api/projects/:id
 */
router.get('/:id', async (req, res) => {
  const client = getSupabase();
  if (!client) {
    return res.status(500).json({ error: 'Database client not initialized' });
  }

  try {
    const [
      { data: project, error: pErr },
      { data: applications, error: aErr },
      { data: files, error: fErr }
    ] = await Promise.all([
      client.from('projects').select('*').eq('id', req.params.id).single(),
      client.from('applications').select('*').eq('project_id', req.params.id).order('created_at', { ascending: false }),
      client.from('project_files').select('*').eq('project_id', req.params.id).order('created_at', { ascending: false })
    ]);

    if (pErr || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json({
      ...project,
      applications: applications || [],
      files: files || []
    });
  } catch (err) {
    console.error('[Supabase DB] Error fetching project details:', err.message);
    return res.status(500).json({ error: 'Failed to fetch project from database', message: err.message });
  }
});

/**
 * Create new project directly in Supabase DB
 * POST /api/projects
 */
router.post('/', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const client = getSupabase();
  if (!client) {
    return res.status(500).json({ error: 'Database client not initialized' });
  }

  const now = new Date().toISOString();
  const newProject = {
    id: uuidv4(),
    name: name.trim(),
    description: description ? description.trim() : '',
    created_at: now,
    updated_at: now
  };

  try {
    const { data, error } = await client
      .from('projects')
      .insert(newProject)
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data || newProject);
  } catch (err) {
    console.error('[Supabase DB] Error creating project:', err.message);
    return res.status(500).json({ error: 'Failed to create project in database', message: err.message });
  }
});

/**
 * Update project directly in Supabase DB
 * PUT /api/projects/:id
 */
router.put('/:id', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) {
    return res.status(500).json({ error: 'Database client not initialized' });
  }

  const { name, description } = req.body;
  const updatePayload = { updated_at: new Date().toISOString() };
  if (name !== undefined) updatePayload.name = name.trim();
  if (description !== undefined) updatePayload.description = description.trim();

  try {
    const { data, error } = await client
      .from('projects')
      .update(updatePayload)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Project not found or update failed' });
    }

    return res.json(data);
  } catch (err) {
    console.error('[Supabase DB] Error updating project:', err.message);
    return res.status(500).json({ error: 'Failed to update project in database', message: err.message });
  }
});

/**
 * Delete project directly from Supabase DB (cascades automatically via FKs)
 * DELETE /api/projects/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) {
    return res.status(500).json({ error: 'Database client not initialized' });
  }

  try {
    const { error } = await client
      .from('projects')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    return res.json({ success: true, message: 'Project and associated resources deleted from database' });
  } catch (err) {
    console.error('[Supabase DB] Error deleting project:', err.message);
    return res.status(500).json({ error: 'Failed to delete project from database', message: err.message });
  }
});

/**
 * List project files directly from Supabase DB
 * GET /api/projects/:id/files
 */
router.get('/:id/files', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data, error } = await client
      .from('project_files')
      .select('*')
      .eq('project_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list project files', message: err.message });
  }
});

/**
 * Upload project file (Stores in Supabase Storage and records in Supabase project_files DB)
 * POST /api/projects/:id/files
 */
router.post('/:id/files', requireAuth, upload.single('file'), async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data: project } = await client
      .from('projects')
      .select('id, name')
      .eq('id', req.params.id)
      .single();

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
      storage_path: fileResult.storagePath,
      file_size_bytes: fileResult.sizeBytes,
      mime_type: fileResult.mimeType,
      created_at: new Date().toISOString()
    };

    const { data: insertedFile, error: insertErr } = await client
      .from('project_files')
      .insert(newFile)
      .select()
      .single();

    if (insertErr) throw insertErr;
    return res.status(201).json(insertedFile || newFile);
  } catch (err) {
    console.error('[Supabase Storage] Project file upload error:', err);
    return res.status(500).json({ error: 'File upload failed', message: err.message });
  }
});

/**
 * Download signed URL directly using Supabase file record
 * GET /api/projects/:id/files/:fileId/download
 */
router.get('/:id/files/:fileId/download', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data: file, error } = await client
      .from('project_files')
      .select('*')
      .eq('id', req.params.fileId)
      .single();

    if (error || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const downloadInfo = await getStorageDownloadUrl(file);
    return res.json(downloadInfo);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate signed URL', message: err.message });
  }
});

/**
 * Direct file download redirect endpoint
 * GET /api/projects/files/download/:fileId
 */
router.get('/files/download/:fileId', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).send('Database not initialized');

  try {
    const { data: file } = await client
      .from('project_files')
      .select('*')
      .eq('id', req.params.fileId)
      .single();

    if (!file) {
      return res.status(404).send('File not found');
    }

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
 * Delete project file from both Supabase Storage and project_files DB table
 * DELETE /api/projects/:id/files/:fileId
 */
router.delete('/:id/files/:fileId', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data: file } = await client
      .from('project_files')
      .select('*')
      .eq('id', req.params.fileId)
      .single();

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await deleteFileFromStorage(file);
    await client.from('project_files').delete().eq('id', req.params.fileId);

    return res.json({ success: true, message: 'File deleted successfully from database and storage' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete file', message: err.message });
  }
});

export default router;
