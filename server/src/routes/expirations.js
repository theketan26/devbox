import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { saveRecordToSupabase, deleteRecordFromSupabase } from '../services/supabase.js';

const router = express.Router();

/**
 * List credential expirations with calculated urgency status
 * GET /api/expirations
 */
router.get('/', (req, res) => {
  const { applicationId } = req.query;
  let items = db.data.credential_expirations;

  if (applicationId) {
    items = items.filter(e => e.application_id === applicationId);
  }

  const now = Date.now();
  const enriched = items.map(item => {
    const expiresTime = new Date(item.expires_at).getTime();
    const diffMs = expiresTime - now;
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let status = 'SAFE';
    if (daysRemaining <= 0) {
      status = 'EXPIRED';
    } else if (daysRemaining <= 7) {
      status = 'CRITICAL';
    } else if (daysRemaining <= (item.alert_days_before || 14)) {
      status = 'WARNING';
    }

    const app = db.data.applications.find(a => a.id === item.application_id);
    const project = app ? db.data.projects.find(p => p.id === app.project_id) : null;

    return {
      ...item,
      daysRemaining,
      status,
      applicationName: app ? app.name : 'Unknown Application',
      projectName: project ? project.name : 'Unknown Project'
    };
  });

  // Sort by urgency (expired & critical first)
  enriched.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return res.json(enriched);
});

/**
 * Create credential expiration record
 * POST /api/expirations
 */
router.post('/', requireAuth, (req, res) => {
  const { application_id, name, credential_type, expires_at, alert_days_before = 14, notes } = req.body;

  if (!application_id || !name || !expires_at || !credential_type) {
    return res.status(400).json({ error: 'application_id, name, credential_type, and expires_at are required' });
  }

  const newExp = {
    id: uuidv4(),
    application_id,
    name: name.trim(),
    credential_type, // 'api_token', 'ssl_cert', 'domain', 'saas_key'
    expires_at: new Date(expires_at).toISOString(),
    alert_days_before: Number(alert_days_before) || 14,
    notes: notes ? notes.trim() : '',
    is_notified: false,
    created_at: new Date().toISOString()
  };

  db.data.credential_expirations.push(newExp);
  db.save();
  saveRecordToSupabase('credential_expirations', newExp);

  return res.status(201).json(newExp);
});

/**
 * Delete credential expiration record
 * DELETE /api/expirations/:id
 */
router.delete('/:id', requireAuth, (req, res) => {
  const index = db.data.credential_expirations.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Expiration item not found' });
  }

  db.data.credential_expirations.splice(index, 1);
  db.save();
  deleteRecordFromSupabase('credential_expirations', req.params.id);

  return res.json({ success: true });
});

export default router;
