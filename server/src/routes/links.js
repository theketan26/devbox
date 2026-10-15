import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { saveRecordToSupabase, deleteRecordFromSupabase } from '../services/supabase.js';

const router = express.Router();

/**
 * List application and project resource links
 * GET /api/links
 */
router.get('/', (req, res) => {
  const { applicationId, projectId, includeArchived } = req.query;
  let links = db.data.application_links;

  if (applicationId) {
    links = links.filter(l => l.application_id === applicationId);
  } else if (projectId) {
    const projectApps = db.data.applications.filter(a => a.project_id === projectId).map(a => a.id);
    links = links.filter(l => l.project_id === projectId || projectApps.includes(l.application_id));
  }

  if (includeArchived !== 'true') {
    links = links.filter(l => !l.is_archived);
  }

  return res.json(links);
});

/**
 * Create resource link
 * POST /api/links
 */
router.post('/', requireAuth, (req, res) => {
  const { application_id, project_id, title, url, category = 'General', notes } = req.body;

  if ((!application_id && !project_id) || !title || !url) {
    return res.status(400).json({ error: 'application_id or project_id, title, and url are required' });
  }

  const now = new Date().toISOString();
  const newLink = {
    id: uuidv4(),
    application_id: application_id || null,
    project_id: project_id || null,
    title: title.trim(),
    url: url.trim(),
    category: category.trim(),
    notes: notes ? notes.trim() : '',
    is_archived: false,
    created_at: now,
    updated_at: now
  };

  db.data.application_links.push(newLink);
  db.save();
  saveRecordToSupabase('application_links', newLink);

  return res.status(201).json(newLink);
});

/**
 * Toggle archived status
 * PATCH /api/links/:id/archive
 */
router.patch('/:id/archive', requireAuth, (req, res) => {
  const link = db.data.application_links.find(l => l.id === req.params.id);
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  link.is_archived = !link.is_archived;
  link.updated_at = new Date().toISOString();
  db.save();
  saveRecordToSupabase('application_links', link);

  return res.json(link);
});

/**
 * Delete resource link
 * DELETE /api/links/:id
 */
router.delete('/:id', requireAuth, (req, res) => {
  const index = db.data.application_links.findIndex(l => l.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Link not found' });
  }

  db.data.application_links.splice(index, 1);
  db.save();
  deleteRecordFromSupabase('application_links', req.params.id);

  return res.json({ success: true });
});

export default router;
