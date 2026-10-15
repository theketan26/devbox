import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { getSupabase } from '../services/supabase.js';

const router = express.Router();

/**
 * List credential expirations with calculated urgency status directly from Supabase DB
 * GET /api/expirations
 */
router.get('/', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const { applicationId } = req.query;

  try {
    let expQuery = client.from('credential_expirations').select('*').order('expires_at', { ascending: true });
    if (applicationId) {
      expQuery = expQuery.eq('application_id', applicationId);
    }

    const [
      { data: rawItems, error: eErr },
      { data: allApps, error: aErr },
      { data: allProjects, error: pErr }
    ] = await Promise.all([
      expQuery,
      client.from('applications').select('*'),
      client.from('projects').select('*')
    ]);

    if (eErr) throw eErr;

    const items = rawItems || [];
    const apps = allApps || [];
    const projects = allProjects || [];

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

      const app = apps.find(a => a.id === item.application_id);
      const project = app ? projects.find(p => p.id === app.project_id) : null;

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
  } catch (err) {
    console.error('GET /api/expirations error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Create credential expiration record directly in Supabase DB
 * POST /api/expirations
 */
router.post('/', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

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

  try {
    const { data, error } = await client
      .from('credential_expirations')
      .insert(newExp)
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data || newExp);
  } catch (err) {
    console.error('POST /api/expirations error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Delete credential expiration record directly from Supabase DB
 * DELETE /api/expirations/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { error } = await client
      .from('credential_expirations')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/expirations/:id error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
