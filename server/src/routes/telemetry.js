import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { getSupabase } from '../services/supabase.js';

const router = express.Router();

/**
 * Ingestion endpoint for deployed applications directly into Supabase DB
 * POST /api/telemetry/ingest
 */
router.post('/ingest', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const token = req.headers['x-telemetry-token'] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

  if (!token) {
    return res.status(401).json({ error: 'Missing telemetry token in x-telemetry-token or Authorization header' });
  }

  try {
    const { data: app, error: aErr } = await client
      .from('applications')
      .select('*')
      .eq('telemetry_token', token)
      .single();

    if (aErr || !app) {
      return res.status(403).json({ error: 'Invalid telemetry token' });
    }

    const {
      memory_rss_mb,
      memory_heap_mb,
      uptime_seconds,
      db_active_connections,
      cpu_usage_pct
    } = req.body;

    const entry = {
      id: uuidv4(),
      application_id: app.id,
      memory_rss_mb: Number(memory_rss_mb) || 0,
      memory_heap_mb: Number(memory_heap_mb) || 0,
      uptime_seconds: Number(uptime_seconds) || 0,
      db_active_connections: Number(db_active_connections) || 0,
      cpu_usage_pct: Number(cpu_usage_pct) || 0,
      created_at: new Date().toISOString()
    };

    const { error: iErr } = await client
      .from('application_telemetry')
      .insert(entry);

    if (iErr) throw iErr;

    return res.status(201).json({
      success: true,
      application: app.name,
      recordedAt: entry.created_at
    });
  } catch (err) {
    console.error('POST /api/telemetry/ingest error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Get telemetry history for application dashboard charts directly from Supabase DB
 * GET /api/telemetry/:applicationId
 */
router.get('/:applicationId', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data, error } = await client
      .from('application_telemetry')
      .select('*')
      .eq('application_id', req.params.applicationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return res.json(data || []);
  } catch (err) {
    console.error('GET /api/telemetry/:applicationId error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Helper to simulate metric ingestion directly into Supabase DB
 * POST /api/telemetry/:applicationId/simulate
 */
router.post('/:applicationId/simulate', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data: app, error: aErr } = await client
      .from('applications')
      .select('*')
      .eq('id', req.params.applicationId)
      .single();

    if (aErr || !app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const { data: lastEntries } = await client
      .from('application_telemetry')
      .select('*')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastEntry = lastEntries && lastEntries.length > 0 ? lastEntries[0] : null;

    const baseRss = lastEntry ? lastEntry.memory_rss_mb : 150;
    const baseHeap = lastEntry ? lastEntry.memory_heap_mb : 85;
    const baseUptime = lastEntry ? lastEntry.uptime_seconds + 60 : 3600;

    const entry = {
      id: uuidv4(),
      application_id: app.id,
      memory_rss_mb: +(baseRss + (Math.random() * 10 - 5)).toFixed(2),
      memory_heap_mb: +(baseHeap + (Math.random() * 8 - 4)).toFixed(2),
      uptime_seconds: baseUptime,
      db_active_connections: Math.max(1, Math.floor(10 + (Math.random() * 6 - 3))),
      cpu_usage_pct: +(15 + Math.random() * 25).toFixed(2),
      created_at: new Date().toISOString()
    };

    const { data: inserted, error: iErr } = await client
      .from('application_telemetry')
      .insert(entry)
      .select()
      .single();

    if (iErr) throw iErr;

    return res.status(201).json(inserted || entry);
  } catch (err) {
    console.error('POST /api/telemetry/:applicationId/simulate error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
