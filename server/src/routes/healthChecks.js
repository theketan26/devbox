import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { executeHealthCheck, runAllDueHealthChecks } from '../services/healthChecker.js';
import { requireAuth, requireCronSecret } from '../middleware/auth.js';
import {
  createOrUpdateProbeCron,
  deleteProbeCron,
  fetchAllPgCrons,
  syncHealthChecksWithPgCron,
  saveRecordToSupabase,
  deleteRecordFromSupabase
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
  const { applicationId } = req.query;
  let checks = db.data.health_checks;

  if (applicationId) {
    checks = checks.filter(c => c.application_id === applicationId);
  }

  // Fetch Supabase pg_crons to enrich each probe
  const pgCrons = await fetchAllPgCrons();

  const enriched = checks.map(c => {
    const logs = db.data.health_check_logs
      .filter(l => l.health_check_id === c.id)
      .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime());

    const app = db.data.applications.find(a => a.id === c.application_id);
    const project = app ? db.data.projects.find(p => p.id === app.project_id) : null;

    // Calculate uptime percentage over available logs
    const totalRuns = logs.length;
    const successfulRuns = logs.filter(l => l.is_success).length;
    const uptimePct = totalRuns > 0 ? +((successfulRuns / totalRuns) * 100).toFixed(1) : 100.0;

    // Associated pg_cron job from Supabase
    const pgCronJob = pgCrons.find(j => j.health_check_id === c.id) || null;

    return {
      ...c,
      applicationName: app ? app.name : 'Unknown Application',
      projectName: project ? project.name : 'Unknown Project',
      uptimePct,
      recentLogs: logs.slice(0, 10),
      pg_cron: pgCronJob
    };
  });

  return res.json(enriched);
});

/**
 * Get single health check details
 * GET /api/health-checks/:id
 */
router.get('/:id', async (req, res) => {
  const check = db.data.health_checks.find(c => c.id === req.params.id);
  if (!check) {
    return res.status(404).json({ error: 'Health check not found' });
  }

  const logs = db.data.health_check_logs
    .filter(l => l.health_check_id === check.id)
    .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime());

  const pgCrons = await fetchAllPgCrons();
  const pgCron = pgCrons.find(j => j.health_check_id === check.id) || null;

  return res.json({
    ...check,
    logs,
    pg_cron: pgCron
  });
});

/**
 * Create health check and register Supabase pg_cron job
 * POST /api/health-checks
 */
router.post('/', requireAuth, async (req, res) => {
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

  db.data.health_checks.push(newCheck);
  db.save();
  saveRecordToSupabase('health_checks', newCheck);

  // Register native pg_cron job in Supabase
  const pgCron = await createOrUpdateProbeCron(newCheck);

  return res.status(201).json({
    ...newCheck,
    pg_cron: pgCron
  });
});

/**
 * Update health check or toggle maintenance mode and update Supabase pg_cron
 * PUT /api/health-checks/:id
 */
router.put('/:id', requireAuth, async (req, res) => {
  const check = db.data.health_checks.find(c => c.id === req.params.id);
  if (!check) {
    return res.status(404).json({ error: 'Health check not found' });
  }

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

  if (name) check.name = name.trim();
  if (endpoint_url) check.endpoint_url = endpoint_url.trim();
  if (method) check.method = method.toUpperCase();
  if (interval_minutes !== undefined) check.interval_minutes = Number(interval_minutes);
  if (timeout_ms !== undefined) check.timeout_ms = Number(timeout_ms);
  if (expected_status !== undefined) check.expected_status = Number(expected_status);
  if (expected_json_payload !== undefined) check.expected_json_payload = expected_json_payload;
  if (is_active !== undefined) check.is_active = Boolean(is_active);

  if (is_maintenance_mode !== undefined) {
    check.is_maintenance_mode = Boolean(is_maintenance_mode);
    if (check.is_maintenance_mode) {
      check.current_status = 'maintenance';
      check.consecutive_failures = 0;
      check.down_since = null;
    } else {
      check.current_status = 'unknown';
    }
  }

  db.save();
  saveRecordToSupabase('health_checks', check);

  // Update pg_cron job in Supabase (updates schedule and active status)
  const pgCron = await createOrUpdateProbeCron(check);

  return res.json({
    ...check,
    pg_cron: pgCron
  });
});

/**
 * Trigger immediate ping on health check
 * POST /api/health-checks/:id/ping
 */
router.post('/:id/ping', requireAuth, async (req, res) => {
  const result = await executeHealthCheck(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Health check not found' });
  }

  // Update pg_cron status
  const check = db.data.health_checks.find(c => c.id === req.params.id);
  let pgCron = null;
  if (check) {
    pgCron = await createOrUpdateProbeCron(check);
  }

  return res.json({
    ...result,
    pg_cron: pgCron
  });
});

/**
 * Delete health check and unschedule Supabase pg_cron job
 * DELETE /api/health-checks/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const index = db.data.health_checks.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Health check not found' });
  }

  // Unschedule from Supabase pg_cron
  await deleteProbeCron(req.params.id);

  db.data.health_checks.splice(index, 1);
  db.data.health_check_logs = db.data.health_check_logs.filter(l => l.health_check_id !== req.params.id);
  db.save();
  deleteRecordFromSupabase('health_checks', req.params.id);

  return res.json({ success: true, message: 'Health check and pg_cron unscheduled' });
});

/**
 * Probing endpoint invoked by Supabase pg_cron via pg_net
 * GET /api/health-checks/cron/run
 */
router.get('/cron/run', requireCronSecret, async (req, res) => {
  console.log('[Cron] Health check trigger received via pg_net/cron');
  const { id } = req.query;

  if (id) {
    const singleResult = await executeHealthCheck(id);
    const check = db.data.health_checks.find(c => c.id === id);
    if (check) {
      await createOrUpdateProbeCron(check);
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
});

export default router;
