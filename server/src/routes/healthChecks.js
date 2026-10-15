import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeHealthCheck, runAllDueHealthChecks } from '../services/healthChecker.js';
import { requireAuth, requireCronSecret } from '../middleware/auth.js';
import {
  createOrUpdateProbeCron,
  deleteProbeCron,
  fetchAllPgCrons,
  syncHealthChecksWithPgCron,
  getSupabase
} from '../services/supabase.js';

const router = express.Router();

/**
 * List all active Supabase pg_cron jobs
 * GET /api/health-checks/pg-cron
 */
router.get('/pg-cron', async (req, res) => {
  try {
    const jobs = await fetchAllPgCrons();
    return res.json({
      success: true,
      count: jobs.length,
      jobs
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch pg_cron jobs', message: err.message });
  }
});

/**
 * Re-sync all health check probes with pg_cron
 * POST /api/health-checks/pg-cron/sync
 */
router.post('/pg-cron/sync', requireAuth, async (req, res) => {
  try {
    await syncHealthChecksWithPgCron();
    const jobs = await fetchAllPgCrons();
    return res.json({
      success: true,
      message: 'All health check probes synced with Supabase pg_cron',
      jobs
    });
  } catch (err) {
    return res.status(500).json({ error: 'Sync failed', message: err.message });
  }
});

/**
 * List all health checks with summary status and Supabase pg_cron details
 * GET /api/health-checks
 */
router.get('/', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const { applicationId } = req.query;

  try {
    let checkQuery = client.from('health_checks').select('*').order('created_at', { ascending: false });
    if (applicationId) {
      checkQuery = checkQuery.eq('application_id', applicationId);
    }

    const [
      { data: rawChecks, error: cErr },
      { data: allApps, error: aErr },
      { data: allProjects, error: pErr },
      { data: allLogs, error: lErr },
      pgCrons
    ] = await Promise.all([
      checkQuery,
      client.from('applications').select('*'),
      client.from('projects').select('*'),
      client.from('health_check_logs').select('*').order('checked_at', { ascending: false }),
      fetchAllPgCrons()
    ]);

    if (cErr) throw cErr;

    const checks = rawChecks || [];
    const apps = allApps || [];
    const projects = allProjects || [];
    const logs = allLogs || [];

    const enriched = checks.map(c => {
      const checkLogs = logs.filter(l => l.health_check_id === c.id);
      const app = apps.find(a => a.id === c.application_id);
      const project = app ? projects.find(p => p.id === app.project_id) : null;

      const totalRuns = checkLogs.length;
      const successfulRuns = checkLogs.filter(l => l.is_success).length;
      const uptimePct = totalRuns > 0 ? +((successfulRuns / totalRuns) * 100).toFixed(1) : 100.0;

      const pgCronJob = (pgCrons || []).find(j => j.health_check_id === c.id) || null;

      return {
        ...c,
        applicationName: app ? app.name : 'Unknown Application',
        projectName: project ? project.name : 'Unknown Project',
        uptimePct,
        recentLogs: checkLogs.slice(0, 10),
        pg_cron: pgCronJob
      };
    });

    return res.json(enriched);
  } catch (err) {
    console.error('GET /api/health-checks error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Get single health check details
 * GET /api/health-checks/:id
 */
router.get('/:id', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const [
      { data: check, error: cErr },
      { data: logs, error: lErr },
      pgCrons
    ] = await Promise.all([
      client.from('health_checks').select('*').eq('id', req.params.id).single(),
      client.from('health_check_logs').select('*').eq('health_check_id', req.params.id).order('checked_at', { ascending: false }),
      fetchAllPgCrons()
    ]);

    if (cErr || !check) {
      return res.status(404).json({ error: 'Health check not found' });
    }

    const pgCron = (pgCrons || []).find(j => j.health_check_id === check.id) || null;

    return res.json({
      ...check,
      logs: logs || [],
      pg_cron: pgCron
    });
  } catch (err) {
    console.error('GET /api/health-checks/:id error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Create health check and register Supabase pg_cron job
 * POST /api/health-checks
 */
router.post('/', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const {
    application_id,
    name,
    endpoint_url,
    method = 'GET',
    interval_minutes = 5,
    timeout_ms = 5000,
    expected_status = 200,
    expected_json_payload = null,
    is_maintenance_mode = false
  } = req.body;

  if (!application_id || !name || !endpoint_url) {
    return res.status(400).json({ error: 'application_id, name, and endpoint_url are required' });
  }

  const now = new Date().toISOString();
  const newCheck = {
    id: uuidv4(),
    application_id,
    name: name.trim(),
    endpoint_url: endpoint_url.trim(),
    method: method.toUpperCase(),
    interval_minutes: Number(interval_minutes) || 5,
    timeout_ms: Number(timeout_ms) || 5000,
    expected_status: Number(expected_status) || 200,
    expected_json_payload: expected_json_payload || null,
    is_maintenance_mode: Boolean(is_maintenance_mode),
    current_status: is_maintenance_mode ? 'maintenance' : 'unknown',
    consecutive_failures: 0,
    down_since: null,
    last_checked_at: null,
    last_status_code: null,
    last_response_time_ms: null,
    last_alerted_at: null,
    is_active: true,
    created_at: now
  };

  try {
    const { data: inserted, error: iErr } = await client
      .from('health_checks')
      .insert(newCheck)
      .select()
      .single();

    if (iErr) throw iErr;

    // Register native pg_cron job in Supabase
    const pgCron = await createOrUpdateProbeCron(inserted || newCheck);

    return res.status(201).json({
      ...(inserted || newCheck),
      pg_cron: pgCron
    });
  } catch (err) {
    console.error('POST /api/health-checks error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Update health check or toggle maintenance mode and update Supabase pg_cron
 * PUT /api/health-checks/:id
 */
router.put('/:id', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const {
    name,
    endpoint_url,
    method,
    interval_minutes,
    timeout_ms,
    expected_status,
    expected_json_payload,
    is_maintenance_mode,
    is_active
  } = req.body;

  const updates = {};
  if (name) updates.name = name.trim();
  if (endpoint_url) updates.endpoint_url = endpoint_url.trim();
  if (method) updates.method = method.toUpperCase();
  if (interval_minutes !== undefined) updates.interval_minutes = Number(interval_minutes);
  if (timeout_ms !== undefined) updates.timeout_ms = Number(timeout_ms);
  if (expected_status !== undefined) updates.expected_status = Number(expected_status);
  if (expected_json_payload !== undefined) updates.expected_json_payload = expected_json_payload;
  if (is_active !== undefined) updates.is_active = Boolean(is_active);

  if (is_maintenance_mode !== undefined) {
    updates.is_maintenance_mode = Boolean(is_maintenance_mode);
    if (updates.is_maintenance_mode) {
      updates.current_status = 'maintenance';
      updates.consecutive_failures = 0;
      updates.down_since = null;
    } else {
      updates.current_status = 'unknown';
    }
  }

  try {
    const { data: updated, error: uErr } = await client
      .from('health_checks')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (uErr) throw uErr;

    const pgCron = await createOrUpdateProbeCron(updated);

    return res.json({
      ...updated,
      pg_cron: pgCron
    });
  } catch (err) {
    console.error('PUT /api/health-checks/:id error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Trigger immediate ping on health check
 * POST /api/health-checks/:id/ping
 */
router.post('/:id/ping', requireAuth, async (req, res) => {
  try {
    const result = await executeHealthCheck(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Health check not found' });
    }

    const client = getSupabase();
    let pgCron = null;
    if (client) {
      const { data: check } = await client.from('health_checks').select('*').eq('id', req.params.id).single();
      if (check) {
        pgCron = await createOrUpdateProbeCron(check);
      }
    }

    return res.json({
      ...result,
      pg_cron: pgCron
    });
  } catch (err) {
    console.error('POST /api/health-checks/:id/ping error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Delete health check and unschedule Supabase pg_cron job
 * DELETE /api/health-checks/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    await deleteProbeCron(req.params.id);

    // Delete logs first
    await client.from('health_check_logs').delete().eq('health_check_id', req.params.id);

    // Delete check
    const { error } = await client.from('health_checks').delete().eq('id', req.params.id);
    if (error) throw error;

    return res.json({ success: true, message: 'Health check and pg_cron unscheduled' });
  } catch (err) {
    console.error('DELETE /api/health-checks/:id error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Probing endpoint invoked by Supabase pg_cron via pg_net
 * GET /api/health-checks/cron/run
 */
router.get('/cron/run', requireCronSecret, async (req, res) => {
  console.log('[Cron] Health check trigger received via pg_net/cron');
  const { id } = req.query;

  try {
    if (id) {
      const singleResult = await executeHealthCheck(id);
      const client = getSupabase();
      if (client) {
        const { data: check } = await client.from('health_checks').select('*').eq('id', id).single();
        if (check) {
          await createOrUpdateProbeCron(check);
        }
      }
      return res.json({
        success: true,
        executedCount: 1,
        timestamp: new Date().toISOString(),
        result: singleResult
      });
    }

    const results = await runAllDueHealthChecks();
    return res.json({
      success: true,
      executedCount: results.length,
      timestamp: new Date().toISOString(),
      results
    });
  } catch (err) {
    console.error('GET /api/health-checks/cron/run error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
