import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';
import {
  normalizeCron,
  isValidCron,
  getNextCronRun,
  describeCron,
  intervalToCronExpression,
  cronToIntervalMinutes
} from '../utils/cronHelper.js';
import { getProbeMetadata, setProbeMetadata } from './probeMetadataStore.js';

let supabaseClient = null;
let isConnected = false;
let lastConnectionCheck = 0;
let pgCronsStore = [];

// Initialize Supabase Client if credentials are provided
export function initSupabase() {
  const url = config.supabaseUrl;
  const key = config.supabaseServiceRoleKey;

  if (url && key) {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      console.log(`[Supabase] SDK initialized with endpoint: ${url}`);
    } catch (err) {
      console.error('[Supabase] Initialization failed:', err.message);
      supabaseClient = null;
    }
  } else {
    console.warn('[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY/SUPABASE_ANON_KEY) not provided in environment variables.');
    supabaseClient = null;
  }
  return supabaseClient;
}

export function getSupabase() {
  if (!supabaseClient && config.supabaseUrl && config.supabaseServiceRoleKey) {
    initSupabase();
  }
  return supabaseClient;
}

/**
 * Check connection status with Supabase
 */
export async function getSupabaseStatus() {
  const isConfigured = Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
  const now = Date.now();

  // Cache connection state for 15 seconds to avoid spamming
  if (now - lastConnectionCheck < 15000 && isConnected) {
    return {
      configured: isConfigured,
      connected: isConnected,
      mode: isConnected ? 'supabase_live' : 'supabase_disconnected',
      url: config.supabaseUrl ? config.supabaseUrl.replace(/^(https?:\/\/[^.]+).*/, '$1.supabase.co') : null
    };
  }

  if (!isConfigured) {
    return {
      configured: false,
      connected: false,
      mode: 'supabase_unconfigured',
      message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not configured in server/.env'
    };
  }

  try {
    const client = getSupabase();
    if (!client) throw new Error('Client not initialized');
    // Test query on projects table
    const { error } = await client.from('projects').select('id').limit(1);
    isConnected = !error;
    lastConnectionCheck = now;
    return {
      configured: true,
      connected: isConnected,
      mode: isConnected ? 'supabase_live' : 'supabase_error',
      url: config.supabaseUrl,
      error: error ? error.message : null
    };
  } catch (err) {
    isConnected = false;
    lastConnectionCheck = now;
    return {
      configured: true,
      connected: false,
      mode: 'supabase_error',
      error: err.message
    };
  }
}

// ============================================================================
// PROJECTS REPOSITORY (Direct Supabase DB)
// ============================================================================

export async function fetchProjectsFromSupabase() {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] fetchProjects error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('[Supabase] fetchProjects exception:', err.message);
    return [];
  }
}

export async function saveProjectToSupabase(project) {
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('projects')
        .upsert({
          id: project.id,
          name: project.name,
          description: project.description,
          created_at: project.created_at,
          updated_at: project.updated_at
        })
        .select()
        .single();

      if (error) {
        console.warn('[Supabase] upsert project error:', error.message);
      } else {
        return data || project;
      }
    } catch (err) {
      console.warn('[Supabase] saveProject exception:', err.message);
    }
  }
  return project;
}

export async function deleteProjectFromSupabase(id) {
  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('[Supabase] delete project error:', error.message);
      }
    } catch (err) {
      console.warn('[Supabase] deleteProject exception:', err.message);
    }
  }
}

// ============================================================================
// APPLICATIONS REPOSITORY (Direct Supabase DB)
// ============================================================================

export async function fetchApplicationsFromSupabase(projectId) {
  const client = getSupabase();
  if (!client) return [];

  try {
    let query = client.from('applications').select('*').order('created_at', { ascending: false });
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[Supabase] fetchApplications error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('[Supabase] fetchApplications exception:', err.message);
    return [];
  }
}

export async function saveApplicationToSupabase(app) {
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('applications')
        .upsert({
          id: app.id,
          project_id: app.project_id,
          name: app.name,
          description: app.description || '',
          repo_url: app.repo_url || '',
          telemetry_token: app.telemetry_token,
          created_at: app.created_at,
          updated_at: app.updated_at
        })
        .select()
        .single();

      if (error) {
        console.warn('[Supabase] upsert application error:', error.message);
      } else {
        return data || app;
      }
    } catch (err) {
      console.warn('[Supabase] saveApplication exception:', err.message);
    }
  }
  return app;
}

export async function deleteApplicationFromSupabase(id) {
  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client
        .from('applications')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('[Supabase] delete application error:', error.message);
      }
    } catch (err) {
      console.warn('[Supabase] deleteApplication exception:', err.message);
    }
  }
}

// ============================================================================
// GENERIC SUPABASE TABLE REPOSITORIES & SYNC
// ============================================================================

export async function saveRecordToSupabase(tableName, record) {
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client.from(tableName).upsert(record).select().single();
      if (error) {
        console.warn(`[Supabase] Save to ${tableName} warning:`, error.message);
      }
      return data || record;
    } catch (err) {
      console.warn(`[Supabase] Save to ${tableName} exception:`, err.message);
    }
  }
  return record;
}

export async function deleteRecordFromSupabase(tableName, id, primaryKey = 'id') {
  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client.from(tableName).delete().eq(primaryKey, id);
      if (error) {
        console.warn(`[Supabase] Delete from ${tableName} warning:`, error.message);
      }
    } catch (err) {
      console.warn(`[Supabase] Delete from ${tableName} exception:`, err.message);
    }
  }
}

export async function syncAllFromSupabase() {
  console.log('[Supabase] Direct PostgreSQL database mode verified active.');
}

// ============================================================================
// PG_CRON PROBE JOBS ENGINE (Supabase pg_cron + PostgreSQL cron.job)
// ============================================================================

export { intervalToCronExpression };

/**
 * Compute readable next run timestamp from minutes or cron expression
 */
export function calculateNextRun(intervalOrCron) {
  if (typeof intervalOrCron === 'string' && isValidCron(intervalOrCron)) {
    const next = getNextCronRun(intervalOrCron);
    if (next) return next.toISOString();
  }
  const now = new Date();
  const minutes = Math.max(1, Number(intervalOrCron) || 5);
  const next = new Date(now.getTime() + minutes * 60 * 1000);
  return next.toISOString();
}

/**
 * Create or update pg_cron schedule for a health check probe
 * @param {object} healthCheck
 * @param {string} [customCronSchedule]
 * @returns {object} pg_cron job details
 */
export async function createOrUpdateProbeCron(healthCheck, customCronSchedule) {
  const sanitizedName = (healthCheck.name || 'probe')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 18);
  const shortId = healthCheck.id.slice(0, 8);
  const jobName = `devbox_probe_${sanitizedName}_${shortId}`;

  let existingIndex = pgCronsStore.findIndex(
    j => j.health_check_id === healthCheck.id || j.jobname === jobName
  );
  const existingJob = existingIndex >= 0 ? pgCronsStore[existingIndex] : null;
  const meta = getProbeMetadata(healthCheck.id);

  // Preserve existing schedule: only change if explicitly provided or new
  let cronExpr = null;
  if (customCronSchedule && isValidCron(customCronSchedule)) {
    cronExpr = normalizeCron(customCronSchedule);
  } else if (healthCheck.cron_schedule && isValidCron(healthCheck.cron_schedule)) {
    cronExpr = normalizeCron(healthCheck.cron_schedule);
  } else if (meta?.cron_schedule && isValidCron(meta.cron_schedule)) {
    cronExpr = normalizeCron(meta.cron_schedule);
  } else if (existingJob?.schedule && isValidCron(existingJob.schedule)) {
    cronExpr = normalizeCron(existingJob.schedule);
  } else {
    cronExpr = intervalToCronExpression(healthCheck.interval_minutes);
  }

  // Always persist into metadata store so it is never lost or reverted
  setProbeMetadata(healthCheck.id, { cron_schedule: cronExpr });

  const isActive = Boolean(healthCheck.is_active && !healthCheck.is_maintenance_mode);
  const effectiveMinutes = healthCheck.interval_minutes || cronToIntervalMinutes(cronExpr);

  const serverUrl = process.env.APP_URL || `http://localhost:${config.port || 5000}`;
  const pgNetCommand = `SELECT net.http_get(url := '${serverUrl}/api/health-checks/cron/run?id=${healthCheck.id}', headers := jsonb_build_object('Authorization', 'Bearer ${config.cronSecret}', 'Content-Type', 'application/json'));`;

  let jobId = existingIndex >= 0 ? pgCronsStore[existingIndex].jobid : Math.floor(1000 + Math.random() * 9000);
  const nextRunAt = calculateNextRun(cronExpr);

  const cronRecord = {
    jobid: jobId,
    jobname: jobName,
    schedule: cronExpr,
    schedule_description: describeCron(cronExpr),
    command: pgNetCommand,
    nodename: 'supabase-db.internal',
    nodeport: 5432,
    database: 'postgres',
    username: 'postgres',
    active: isActive,
    health_check_id: healthCheck.id,
    health_check_name: healthCheck.name,
    endpoint_url: healthCheck.endpoint_url,
    interval_minutes: effectiveMinutes,
    last_status: healthCheck.current_status === 'healthy' ? 'succeeded' : healthCheck.current_status === 'down' ? 'failed' : 'scheduled',
    last_run_at: healthCheck.last_checked_at || null,
    next_run_at: nextRunAt,
    supabase_synced: false,
    updated_at: new Date().toISOString()
  };

  const client = getSupabase();
  if (client) {
    try {
      const { error: rpcErr } = await client.rpc('cron_schedule', {
        job_name: jobName,
        schedule_expr: cronExpr,
        sql_command: pgNetCommand
      });

      if (!rpcErr) {
        cronRecord.supabase_synced = true;
      } else {
        const { error: tblErr } = await client
          .from('devbox_pg_crons')
          .upsert({
            jobid: jobId,
            jobname: jobName,
            schedule: cronExpr,
            command: pgNetCommand,
            active: isActive,
            health_check_id: healthCheck.id,
            health_check_name: healthCheck.name,
            endpoint_url: healthCheck.endpoint_url,
            interval_minutes: effectiveMinutes,
            last_status: cronRecord.last_status,
            last_run_at: cronRecord.last_run_at,
            next_run_at: cronRecord.next_run_at,
            updated_at: cronRecord.updated_at
          });

        if (!tblErr) {
          cronRecord.supabase_synced = true;
        }
      }
    } catch (err) {
      console.warn(`[Supabase pg_cron] Remote schedule notice: ${err.message}`);
    }
  }

  if (existingIndex >= 0) {
    pgCronsStore[existingIndex] = { ...pgCronsStore[existingIndex], ...cronRecord };
  } else {
    pgCronsStore.push(cronRecord);
  }

  return cronRecord;
}

/**
 * Remove pg_cron job when health check is deleted
 * @param {string} healthCheckId
 */
export async function deleteProbeCron(healthCheckId) {
  const job = pgCronsStore.find(j => j.health_check_id === healthCheckId);

  if (job) {
    const client = getSupabase();
    if (client) {
      try {
        await client.rpc('cron_unschedule', { job_name: job.jobname });
        await client.from('devbox_pg_crons').delete().eq('jobname', job.jobname);
      } catch (err) {
        console.warn(`[Supabase pg_cron] Remote unschedule notice: ${err.message}`);
      }
    }

    pgCronsStore = pgCronsStore.filter(j => j.health_check_id !== healthCheckId);
  }
}

/**
 * Fetch all pg_cron jobs from Supabase
 */
export async function fetchAllPgCrons() {
  const client = getSupabase();

  if (client) {
    try {
      // 1. Try querying native cron.job table in Supabase
      const { data: nativeJobs, error: nativeErr } = await client
        .schema('cron')
        .from('job')
        .select('*');

      if (!nativeErr && nativeJobs && nativeJobs.length > 0) {
        return nativeJobs.map(nj => {
          const matchedLocal = pgCronsStore.find(l => l.jobname === nj.jobname);
          return {
            jobid: nj.jobid,
            jobname: nj.jobname,
            schedule: nj.schedule,
            command: nj.command,
            nodename: nj.nodename || 'supabase-db',
            nodeport: nj.nodeport || 5432,
            database: nj.database || 'postgres',
            username: nj.username || 'postgres',
            active: nj.active,
            health_check_id: matchedLocal?.health_check_id || null,
            health_check_name: matchedLocal?.health_check_name || nj.jobname,
            endpoint_url: matchedLocal?.endpoint_url || null,
            interval_minutes: matchedLocal?.interval_minutes || 5,
            last_status: matchedLocal?.last_status || 'scheduled',
            last_run_at: matchedLocal?.last_run_at || null,
            next_run_at: matchedLocal?.next_run_at || calculateNextRun(5),
            source: 'supabase_cron_job'
          };
        });
      }

      // 2. Try querying devbox_pg_crons table in Supabase
      const { data: customJobs, error: customErr } = await client
        .from('devbox_pg_crons')
        .select('*');

      if (!customErr && customJobs && customJobs.length > 0) {
        return customJobs.map(cj => ({
          ...cj,
          source: 'supabase_table'
        }));
      }
    } catch (err) {
      console.warn('[Supabase pg_cron] fetchAllPgCrons remote notice:', err.message);
    }
  }

  return pgCronsStore.map(j => ({
    ...j,
    source: j.supabase_synced ? 'supabase_synced' : 'local_cron_engine'
  }));
}

/**
 * Sync initial pg_crons for all current health checks
 */
export async function syncHealthChecksWithPgCron() {
  const client = getSupabase();
  if (!client) return;

  try {
    const [{ data: checks, error }, { data: existingCrons }] = await Promise.all([
      client.from('health_checks').select('*'),
      client.from('devbox_pg_crons').select('*')
    ]);

    if (error || !checks) return;

    let count = 0;
    for (const check of checks) {
      const existing = (existingCrons || []).find(c => c.health_check_id === check.id);
      const meta = getProbeMetadata(check.id);
      const scheduleToUse = check.cron_schedule || meta?.cron_schedule || existing?.schedule;
      await createOrUpdateProbeCron(check, scheduleToUse);
      count++;
    }

    console.log(`[Supabase pg_cron] Synced ${count} health check probes with pg_cron schedule registry`);
  } catch (err) {
    console.warn('[Supabase pg_cron] syncHealthChecksWithPgCron notice:', err.message);
  }
}

// Initialize on module load
initSupabase();
