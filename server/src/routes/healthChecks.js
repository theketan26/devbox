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
import {
  CRON_PRESETS,
  isValidCron,
  normalizeCron,
  describeCron,
  cronToIntervalMinutes,
  intervalToCronExpression,
  getNextCronRun
} from '../utils/cronHelper.js';
import {
  getProbeMetadata,
  setProbeMetadata,
  deleteProbeMetadata,
  getAllProbeMetadata
} from '../services/probeMetadataStore.js';

const router = express.Router();

/**
 * Get available cron presets and options
 * GET /api/health-checks/cron/presets
 */
router.get('/cron/presets', (req, res) => {
  return res.json({
    success: true,
    presets: CRON_PRESETS
  });
});

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

      const meta = getProbeMetadata(c.id);
      const pgCronJob = (pgCrons || []).find(j => j.health_check_id === c.id) || null;
      const cronSchedule = meta?.cron_schedule || pgCronJob?.schedule || intervalToCronExpression(c.interval_minutes);

      return {
        ...c,
        headers: meta?.headers || null,
        request_body: meta?.request_body !== undefined ? meta.request_body : null,
        cron_schedule: cronSchedule,
        cron_description: describeCron(cronSchedule),
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

    const meta = getProbeMetadata(check.id);
    const pgCron = (pgCrons || []).find(j => j.health_check_id === check.id) || null;
    const cronSchedule = meta?.cron_schedule || pgCron?.schedule || intervalToCronExpression(check.interval_minutes);

    return res.json({
      ...check,
      headers: meta?.headers || null,
      request_body: meta?.request_body !== undefined ? meta.request_body : null,
      cron_schedule: cronSchedule,
      cron_description: describeCron(cronSchedule),
      logs: logs || [],
      pg_cron: pgCron
    });
  } catch (err) {
    console.error('GET /api/health-checks/:id error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Directly update cron schedule and interval for a health check probe
 * PUT /api/health-checks/:id/cron
 * PATCH /api/health-checks/:id/cron
 */
const handleDirectCronUpdate = async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const { cron_schedule, interval_minutes } = req.body;
  if (!cron_schedule && interval_minutes === undefined) {
    return res.status(400).json({ error: 'cron_schedule or interval_minutes is required' });
  }

  try {
    const { data: existing, error: eErr } = await client
      .from('health_checks')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (eErr || !existing) {
      return res.status(404).json({ error: 'Health check not found' });
    }

    let finalCron = null;
    let finalInterval = null;

    if (cron_schedule) {
      finalCron = normalizeCron(cron_schedule);
      if (!finalCron) {
        return res.status(400).json({
          error: 'Invalid cron expression. Expected standard 5-part format (e.g., "0 0 * * *" for daily)'
        });
      }
      finalInterval = interval_minutes !== undefined ? Number(interval_minutes) : cronToIntervalMinutes(finalCron);
    } else {
      finalInterval = Math.max(1, Number(interval_minutes) || 5);
      finalCron = intervalToCronExpression(finalInterval);
    }

    // Update interval_minutes in health_checks database table
    const { data: updated, error: uErr } = await client
      .from('health_checks')
      .update({ interval_minutes: finalInterval })
      .eq('id', req.params.id)
      .select()
      .single();

    if (uErr) throw uErr;

    // Reschedule in pg_cron engine (devbox_pg_crons + Supabase pg_cron)
    setProbeMetadata(req.params.id, { cron_schedule: finalCron });
    const pgCron = await createOrUpdateProbeCron(updated || existing, finalCron);
    const meta = getProbeMetadata(req.params.id);

    return res.json({
      success: true,
      message: `Health probe cron schedule updated to ${finalCron} (${describeCron(finalCron)})`,
      cron_schedule: finalCron,
      cron_description: describeCron(finalCron),
      interval_minutes: finalInterval,
      next_run_at: pgCron?.next_run_at || null,
      pg_cron: pgCron,
      check: {
        ...(updated || existing),
        headers: meta?.headers || null,
        request_body: meta?.request_body !== undefined ? meta.request_body : null,
        cron_schedule: finalCron,
        cron_description: describeCron(finalCron),
        pg_cron: pgCron
      }
    });
  } catch (err) {
    console.error('PUT /api/health-checks/:id/cron error:', err);
    return res.status(500).json({ error: err.message });
  }
};

router.put('/:id/cron', requireAuth, handleDirectCronUpdate);
router.patch('/:id/cron', requireAuth, handleDirectCronUpdate);

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
    interval_minutes,
    cron_schedule,
    timeout_ms = 5000,
    expected_status = 200,
    expected_json_payload = null,
    is_maintenance_mode = false,
    headers = null,
    request_body = null,
    requestBody = null,
    body = null
  } = req.body;

  if (!application_id || !name || !endpoint_url) {
    return res.status(400).json({ error: 'application_id, name, and endpoint_url are required' });
  }

  let validatedCron = null;
  if (cron_schedule) {
    validatedCron = normalizeCron(cron_schedule);
    if (!validatedCron) {
      return res.status(400).json({ error: 'Invalid cron expression format (expected 5 fields, e.g. "0 0 * * *")' });
    }
  }

  const effectiveInterval = interval_minutes !== undefined
    ? Number(interval_minutes)
    : validatedCron
      ? cronToIntervalMinutes(validatedCron)
      : 5;

  const finalCronExpr = validatedCron || intervalToCronExpression(effectiveInterval);

  const now = new Date().toISOString();
  const newCheck = {
    id: uuidv4(),
    application_id,
    name: name.trim(),
    endpoint_url: endpoint_url.trim(),
    method: method.toUpperCase(),
    interval_minutes: effectiveInterval,
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

    // Save custom headers and request body metadata
    const rawBody = request_body !== null ? request_body : (requestBody !== null ? requestBody : body);
    const meta = setProbeMetadata(newCheck.id, { headers, request_body: rawBody, cron_schedule: finalCronExpr });

    // Register native pg_cron job in Supabase
    const pgCron = await createOrUpdateProbeCron(inserted || newCheck, finalCronExpr);

    return res.status(201).json({
      ...(inserted || newCheck),
      headers: meta?.headers || null,
      request_body: meta?.request_body !== undefined ? meta.request_body : null,
      cron_schedule: pgCron?.schedule || meta?.cron_schedule || finalCronExpr,
      cron_description: describeCron(pgCron?.schedule || meta?.cron_schedule || finalCronExpr),
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
    cron_schedule,
    timeout_ms,
    expected_status,
    expected_json_payload,
    is_maintenance_mode,
    is_active,
    headers,
    request_body,
    requestBody,
    body
  } = req.body;

  let validatedCron = null;
  if (cron_schedule) {
    validatedCron = normalizeCron(cron_schedule);
    if (!validatedCron) {
      return res.status(400).json({ error: 'Invalid cron expression format (expected 5 fields, e.g. "0 0 * * *")' });
    }
  }

  const updates = {};
  if (name) updates.name = name.trim();
  if (endpoint_url) updates.endpoint_url = endpoint_url.trim();
  if (method) updates.method = method.toUpperCase();
  if (interval_minutes !== undefined) {
    updates.interval_minutes = Number(interval_minutes);
  } else if (validatedCron) {
    updates.interval_minutes = cronToIntervalMinutes(validatedCron);
  }
  if (timeout_ms !== undefined) updates.timeout_ms = Number(timeout_ms);
  if (expected_status !== undefined) updates.expected_status = Number(expected_status);
  if (expected_json_payload !== undefined) updates.expected_json_payload = expected_json_payload;
  if (is_active !== undefined) updates.is_active = Boolean(is_active);

  try {
    const { data: existing, error: eErr } = await client
      .from('health_checks')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (eErr || !existing) {
      return res.status(404).json({ error: 'Health check not found' });
    }

    if (is_maintenance_mode !== undefined) {
      updates.is_maintenance_mode = Boolean(is_maintenance_mode);
      if (updates.is_maintenance_mode !== existing.is_maintenance_mode) {
        if (updates.is_maintenance_mode) {
          updates.current_status = 'maintenance';
          updates.consecutive_failures = 0;
          updates.down_since = null;
        } else {
          updates.current_status = 'unknown';
        }
      }
    }

    const { data: updated, error: uErr } = await client
      .from('health_checks')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (uErr) throw uErr;

    // Update custom headers, request body, and cron schedule if provided
    const metaUpdates = {};
    if (headers !== undefined) metaUpdates.headers = headers;
    if (request_body !== undefined || requestBody !== undefined || body !== undefined) {
      metaUpdates.request_body = request_body !== undefined ? request_body : (requestBody !== undefined ? requestBody : body);
    }
    if (validatedCron) metaUpdates.cron_schedule = validatedCron;
    if (Object.keys(metaUpdates).length > 0) {
      setProbeMetadata(req.params.id, metaUpdates);
    }
    const meta = getProbeMetadata(req.params.id);
    const scheduleToSet = validatedCron || meta?.cron_schedule;

    const pgCron = await createOrUpdateProbeCron(updated, scheduleToSet);

    return res.json({
      ...updated,
      headers: meta?.headers || null,
      request_body: meta?.request_body !== undefined ? meta.request_body : null,
      cron_schedule: pgCron?.schedule || meta?.cron_schedule || validatedCron || intervalToCronExpression(updated.interval_minutes),
      cron_description: describeCron(pgCron?.schedule || meta?.cron_schedule || validatedCron || intervalToCronExpression(updated.interval_minutes)),
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

    const crons = await fetchAllPgCrons();
    const pgCron = (crons || []).find(j => j.health_check_id === req.params.id) || null;

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
    deleteProbeMetadata(req.params.id);
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
