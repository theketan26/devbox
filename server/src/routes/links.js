import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { getSupabase } from '../services/supabase.js';
import { isValidUuid, cleanUuid } from '../utils/validation.js';

const router = express.Router();

/**
 * List application and project resource links directly from Supabase DB
 * GET /api/links
 */
router.get('/', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const { applicationId, projectId, includeArchived } = req.query;

  try {
    let query = client.from('application_links').select('*').order('created_at', { ascending: false });

    if (includeArchived !== 'true') {
      query = query.eq('is_archived', false);
    }

    if (isValidUuid(applicationId)) {
      query = query.eq('application_id', applicationId);
      const { data, error } = await query;
      if (error) throw error;
      return res.json(data || []);
    }

    if (isValidUuid(projectId)) {
      // Find all apps belonging to this project
      const { data: projectApps } = await client
        .from('applications')
        .select('id')
        .eq('project_id', projectId);

      const appIds = (projectApps || []).map(a => a.id);

      const { data, error } = await query;
      if (error) throw error;

      const filtered = (data || []).filter(l =>
        l.project_id === projectId || (l.application_id && appIds.includes(l.application_id))
      );
      return res.json(filtered);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json(data || []);
  } catch (err) {
    console.error('GET /api/links error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Create resource link directly in Supabase DB
 * POST /api/links
 */
router.post('/', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const { application_id, project_id, title, url, category = 'General', notes } = req.body;

  let cleanAppId = cleanUuid(application_id);
  const cleanProjId = cleanUuid(project_id);

  if ((!cleanAppId && !cleanProjId) || !title || !url) {
    return res.status(400).json({ error: 'Valid application_id or project_id, title, and url are required' });
  }

  // If application_id was not provided, resolve it from the project's applications
  if (!cleanAppId && cleanProjId) {
    const { data: projectApps } = await client
      .from('applications')
      .select('id')
      .eq('project_id', cleanProjId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (projectApps && projectApps.length > 0) {
      cleanAppId = projectApps[0].id;
    }
  }

  const now = new Date().toISOString();
  const linkId = uuidv4();
  const payload = {
    id: linkId,
    title: title.trim(),
    url: url.trim(),
    category: category.trim(),
    notes: notes ? notes.trim() : '',
    is_archived: false,
    created_at: now,
    updated_at: now
  };

  if (cleanAppId) {
    payload.application_id = cleanAppId;
  }

  // Try saving with project_id first if provided
  if (cleanProjId) {
    payload.project_id = cleanProjId;
  }

  try {
    let { data, error } = await client
      .from('application_links')
      .insert(payload)
      .select()
      .single();

    // If project_id column does not exist in schema cache, retry without project_id
    if (error && (error.message?.includes('project_id') || error.code === 'PGRST204')) {
      delete payload.project_id;
      if (!payload.application_id && cleanProjId) {
        const { data: apps } = await client
          .from('applications')
          .select('id')
          .eq('project_id', cleanProjId)
          .limit(1);
        if (apps && apps.length > 0) {
          payload.application_id = apps[0].id;
        }
      }
      const retryResult = await client
        .from('application_links')
        .insert(payload)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) throw error;

    return res.status(201).json(data || payload);
  } catch (err) {
    console.error('POST /api/links error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Toggle archived status directly in Supabase DB
 * PATCH /api/links/:id/archive
 */
router.patch('/:id/archive', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data: link, error: fErr } = await client
      .from('application_links')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fErr || !link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const { data: updated, error: uErr } = await client
      .from('application_links')
      .update({
        is_archived: !link.is_archived,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (uErr) throw uErr;

    return res.json(updated);
  } catch (err) {
    console.error('PATCH /api/links/:id/archive error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Delete resource link directly from Supabase DB
 * DELETE /api/links/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { error } = await client
      .from('application_links')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/links/:id error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
