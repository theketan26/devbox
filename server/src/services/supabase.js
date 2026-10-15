import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';
import { db } from '../db/index.js';

let supabaseClient = null;
let isConnected = false;
let lastConnectionCheck = 0;

// Initialize Supabase Client if credentials are provided
export function initSupabase() {
  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    try {
      supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      console.log(`[Supabase] SDK initialized with endpoint: ${config.supabaseUrl}`);
    } catch (err) {
      console.warn('[Supabase] Initialization failed:', err.message);
      supabaseClient = null;
    }
  } else {
    console.log('[Supabase] Credentials not configured. Operating in local-sync fallback mode.');
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
      mode: isConnected ? 'supabase_live' : 'local_storage',
      url: config.supabaseUrl ? config.supabaseUrl.replace(/^(https?:\/\/[^.]+).*/, '$1.supabase.co') : null
    };
  }

  if (!isConfigured) {
    return {
      configured: false,
      connected: false,
      mode: 'local_storage',
      message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not configured in server/.env'
    };
  }

  try {
    const client = getSupabase();
    if (!client) throw new Error('Client not initialized');
    // Test query on projects table or auth
    const { error } = await client.from('projects').select('id').limit(1);
    isConnected = !error;
    lastConnectionCheck = now;
    return {
      configured: true,
      connected: isConnected,
      mode: isConnected ? 'supabase_live' : 'local_storage',
      url: config.supabaseUrl,
      error: error ? error.message : null
    };
  } catch (err) {
    isConnected = false;
    lastConnectionCheck = now;
    return {
      configured: true,
      connected: false,
      mode: 'local_storage',
      error: err.message
    };
  }
}

// ============================================================================
// PROJECTS REPOSITORY (Supabase DB + Local Sync)
// ============================================================================

export async function fetchProjectsFromSupabase() {
  const client = getSupabase();
  if (!client) {
    return db.data.projects;
  }

  try {
    const { data, error } = await client
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] fetchProjects error, using local data:', error.message);
      return db.data.projects;
    }

    if (data) {
      db.data.projects = data;
    }
    return db.data.projects;
  } catch (err) {
    console.warn('[Supabase] fetchProjects exception:', err.message);
    return db.data.projects;
  }
}

export async function saveProjectToSupabase(project) {
  // Always update local DB
  const existingIdx = db.data.projects.findIndex(p => p.id === project.id);
  if (existingIdx >= 0) {
    db.data.projects[existingIdx] = project;
  } else {
    db.data.projects.unshift(project);
  }
  db.save();

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
        console.log(`[Supabase] Project synced successfully: ${project.name} (${project.id})`);
        return data || project;
      }
    } catch (err) {
      console.warn('[Supabase] saveProject exception:', err.message);
    }
  }

  return project;
}

export async function deleteProjectFromSupabase(id) {
  // Always update local DB
  db.data.projects = db.data.projects.filter(p => p.id !== id);
  db.save();

  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('[Supabase] delete project error:', error.message);
      } else {
        console.log(`[Supabase] Project deleted from remote: ${id}`);
      }
    } catch (err) {
      console.warn('[Supabase] deleteProject exception:', err.message);
    }
  }
}

// ============================================================================
// APPLICATIONS REPOSITORY (Supabase DB + Local Sync)
// ============================================================================

export async function fetchApplicationsFromSupabase(projectId) {
  const client = getSupabase();
  if (!client) {
    return projectId
      ? db.data.applications.filter(a => a.project_id === projectId)
      : db.data.applications;
  }

  try {
    let query = client.from('applications').select('*').order('created_at', { ascending: false });
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[Supabase] fetchApplications error, using local data:', error.message);
      return projectId
        ? db.data.applications.filter(a => a.project_id === projectId)
        : db.data.applications;
    }

    if (data) {
      if (!projectId) {
        db.data.applications = data;
      } else {
        const remaining = db.data.applications.filter(a => a.project_id !== projectId);
        db.data.applications = [...remaining, ...data];
      }
    }

    return projectId
      ? db.data.applications.filter(a => a.project_id === projectId)
      : db.data.applications;
  } catch (err) {
    console.warn('[Supabase] fetchApplications exception:', err.message);
    return projectId
      ? db.data.applications.filter(a => a.project_id === projectId)
      : db.data.applications;
  }
}

export async function saveApplicationToSupabase(app) {
  // Always update local DB
  const existingIdx = db.data.applications.findIndex(a => a.id === app.id);
  if (existingIdx >= 0) {
    db.data.applications[existingIdx] = app;
  } else {
    db.data.applications.push(app);
  }
  db.save();

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
        console.log(`[Supabase] Application synced successfully: ${app.name} (${app.id})`);
        return data || app;
      }
    } catch (err) {
      console.warn('[Supabase] saveApplication exception:', err.message);
    }
  }

  return app;
}

export async function deleteApplicationFromSupabase(id) {
  // Always update local DB
  db.data.applications = db.data.applications.filter(a => a.id !== id);
  db.save();

  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client
        .from('applications')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('[Supabase] delete application error:', error.message);
      } else {
        console.log(`[Supabase] Application deleted from remote: ${id}`);
      }
    } catch (err) {
      console.warn('[Supabase] deleteApplication exception:', err.message);
    }
  }
}

// ============================================================================
// GENERIC SUPABASE TABLE REPOSITORIES & SYNC
// ============================================================================

export async function syncTableWithSupabase(tableName, localKey, primaryKey = 'id') {
  const client = getSupabase();
  if (!client) return db.data[localKey];

  try {
    const { data, error } = await client.from(tableName).select('*');
    if (error) {
      return db.data[localKey];
    }

    if (data) {
      db.data[localKey] = data;
    }
    return db.data[localKey];
  } catch (err) {
    return db.data[localKey];
  }
}

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
  console.log('[Supabase] Initializing full database synchronization from Supabase...');
  await fetchProjectsFromSupabase();
  await fetchApplicationsFromSupabase();
  await syncTableWithSupabase('configs_and_secrets', 'configs_and_secrets');
  await syncTableWithSupabase('config_versions', 'config_versions');
  await syncTableWithSupabase('credential_expirations', 'credential_expirations');
  await syncTableWithSupabase('application_links', 'application_links');
  await syncTableWithSupabase('health_checks', 'health_checks');
  await syncTableWithSupabase('health_check_logs', 'health_check_logs');
  await syncTableWithSupabase('application_telemetry', 'application_telemetry');
  await syncTableWithSupabase('devbox_pg_crons', 'pg_crons', 'jobid');
  console.log('[Supabase] Full database synchronization completed.');
}

// ============================================================================
// PG_CRON PROBE JOBS ENGINE (Supabase pg_cron + PostgreSQL cron.job)
// ============================================================================

/**
 * Generate standard pg_cron schedule expression from minutes interval
 * @param {number} intervalMinutes
 * @returns {string} Cron expression
 */
export function intervalToCronExpression(intervalMinutes) {
  const minutes = Math.max(1, Math.min(60, Number(intervalMinutes) || 5));
  if (minutes === 1) return '* * * * *';
  if (minutes === 60) return '0 * * * *';
  return `*/${minutes} * * * *`;
}

/**
 * Compute readable next run timestamp
 */
export function calculateNextRun(intervalMinutes) {
  const now = new Date();
  const minutes = Math.max(1, Number(intervalMinutes) || 5);
  const next = new Date(now.getTime() + minutes * 60 * 1000);
  return next.toISOString();
}

/**
 * Ensure pg_crons array exists in db
 */
function ensurePgCronsStore() {
  if (!db.data.pg_crons) {
    db.data.pg_crons = [];
  }
  return db.data.pg_crons;
}

/**
 * Create or update pg_cron schedule for a health check probe
 * @param {object} healthCheck
 * @returns {object} pg_cron job details
 */
export async function createOrUpdateProbeCron(healthCheck) {
  ensurePgCronsStore();

  const sanitizedName = (healthCheck.name || 'probe')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 18);
  const shortId = healthCheck.id.slice(0, 8);
  const jobName = `devbox_probe_${sanitizedName}_${shortId}`;
  const cronExpr = intervalToCronExpression(healthCheck.interval_minutes);
  const isActive = Boolean(healthCheck.is_active && !healthCheck.is_maintenance_mode);

  const serverUrl = process.env.APP_URL || `http://localhost:${config.port || 5000}`;
  const pgNetCommand = `SELECT net.http_get(url := '${serverUrl}/api/health-checks/cron/run?id=${healthCheck.id}', headers := jsonb_build_object('Authorization', 'Bearer ${config.cronSecret}', 'Content-Type', 'application/json'));`;

  // Find or generate integer job id (compatible with pg_cron BIGINT jobid)
  let existingIndex = db.data.pg_crons.findIndex(
    j => j.health_check_id === healthCheck.id || j.jobname === jobName
  );

  let jobId = existingIndex >= 0 ? db.data.pg_crons[existingIndex].jobid : Math.floor(1000 + Math.random() * 9000);

  const cronRecord = {
    jobid: jobId,
    jobname: jobName,
    schedule: cronExpr,
    command: pgNetCommand,
    nodename: 'supabase-db.internal',
    nodeport: 5432,
    database: 'postgres',
    username: 'postgres',
    active: isActive,
    health_check_id: healthCheck.id,
    health_check_name: healthCheck.name,
    endpoint_url: healthCheck.endpoint_url,
    interval_minutes: healthCheck.interval_minutes || 5,
    last_status: healthCheck.current_status === 'healthy' ? 'succeeded' : healthCheck.current_status === 'down' ? 'failed' : 'scheduled',
    last_run_at: healthCheck.last_checked_at || null,
    next_run_at: calculateNextRun(healthCheck.interval_minutes),
    supabase_synced: false,
    updated_at: new Date().toISOString()
  };

  // Attempt to schedule natively via Supabase RPC or devbox_pg_crons table if connected
  const client = getSupabase();
  if (client) {
    try {
      // 1. Try to invoke pg_cron schedule RPC if installed
      const { error: rpcErr } = await client.rpc('cron_schedule', {
        job_name: jobName,
        schedule_expr: cronExpr,
        sql_command: pgNetCommand
      });

      if (!rpcErr) {
        cronRecord.supabase_synced = true;
        console.log(`[Supabase pg_cron] Registered native cron.schedule job: ${jobName}`);
      } else {
        // 2. Persist to devbox_pg_crons table in Supabase
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
            interval_minutes: healthCheck.interval_minutes,
            last_status: cronRecord.last_status,
            last_run_at: cronRecord.last_run_at,
            next_run_at: cronRecord.next_run_at,
            updated_at: cronRecord.updated_at
          });

        if (!tblErr) {
          cronRecord.supabase_synced = true;
          console.log(`[Supabase pg_cron] Synced job record to devbox_pg_crons: ${jobName}`);
        }
      }
    } catch (err) {
      console.warn(`[Supabase pg_cron] Remote schedule notice: ${err.message}`);
    }
  }

  // Update local store
  if (existingIndex >= 0) {
    db.data.pg_crons[existingIndex] = {
      ...db.data.pg_crons[existingIndex],
      ...cronRecord
    };
  } else {
    db.data.pg_crons.push(cronRecord);
  }
  db.save();

  return cronRecord;
}

/**
 * Remove pg_cron job when health check is deleted
 * @param {string} healthCheckId
 */
export async function deleteProbeCron(healthCheckId) {
  ensurePgCronsStore();
  const job = db.data.pg_crons.find(j => j.health_check_id === healthCheckId);

  if (job) {
    const client = getSupabase();
    if (client) {
      try {
        await client.rpc('cron_unschedule', { job_name: job.jobname });
        await client.from('devbox_pg_crons').delete().eq('jobname', job.jobname);
        console.log(`[Supabase pg_cron] Unscheduled job: ${job.jobname}`);
      } catch (err) {
        console.warn(`[Supabase pg_cron] Remote unschedule notice: ${err.message}`);
      }
    }

    db.data.pg_crons = db.data.pg_crons.filter(j => j.health_check_id !== healthCheckId);
    db.save();
  }
}

/**
 * Fetch all pg_cron jobs from Supabase or synced store
 */
export async function fetchAllPgCrons() {
  ensurePgCronsStore();
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
          const matchedLocal = db.data.pg_crons.find(l => l.jobname === nj.jobname);
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

  // Fallback to local synced pg_crons store
  return db.data.pg_crons.map(j => ({
    ...j,
    source: j.supabase_synced ? 'supabase_synced' : 'local_cron_engine'
  }));
}

/**
 * Sync initial pg_crons for all current health checks
 */
export async function syncHealthChecksWithPgCron() {
  ensurePgCronsStore();
  const checks = db.data.health_checks || [];
  let count = 0;

  for (const check of checks) {
    await createOrUpdateProbeCron(check);
    count++;
  }

  console.log(`[Supabase pg_cron] Synced ${count} health check probes with pg_cron schedule registry`);
}

// Initialize on module load
initSupabase();
