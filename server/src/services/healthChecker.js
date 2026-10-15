import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { sendWhatsAppAlert } from '../utils/whatsapp.js';
import { getSupabase } from './supabase.js';

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function matchesExpectedJson(actual, expected) {
  if (typeof expected !== 'object' || expected === null) {
    return actual === expected;
  }
  if (typeof actual !== 'object' || actual === null) {
    return false;
  }
  for (const key of Object.keys(expected)) {
    if (!(key in actual)) return false;
    if (!matchesExpectedJson(actual[key], expected[key])) {
      return false;
    }
  }
  return true;
}

/**
 * Execute a single health check by ID directly against Supabase DB
 * @param {string} checkId
 */
export async function executeHealthCheck(checkId) {
  const client = getSupabase();
  if (!client) {
    console.warn('[HealthChecker] Supabase client not available');
    return null;
  }

  const { data: check, error: cErr } = await client
    .from('health_checks')
    .select('*')
    .eq('id', checkId)
    .single();

  if (cErr || !check) return null;

  if (check.is_maintenance_mode) {
    console.log(`[HealthChecker] Skipping ${check.name} - maintenance mode active`);
    return {
      status: 'maintenance',
      skipped: true,
      message: 'Maintenance mode active'
    };
  }

  const startTime = Date.now();
  let statusCode = 0;
  let isSuccess = false;
  let errorMessage = null;

  try {
    const res = await axios({
      method: check.method || 'GET',
      url: check.endpoint_url,
      timeout: check.timeout_ms || 5000,
      validateStatus: () => true // Allow any status code to inspect it
    });

    statusCode = res.status;

    // Validate Status Code
    if (statusCode === (check.expected_status || 200)) {
      isSuccess = true;
      // Validate Expected JSON Payload if configured
      if (check.expected_json_payload && Object.keys(check.expected_json_payload).length > 0) {
        if (!matchesExpectedJson(res.data, check.expected_json_payload)) {
          isSuccess = false;
          errorMessage = 'Response body did not match expected JSON payload pattern';
        }
      }
    } else {
      isSuccess = false;
      errorMessage = `Received HTTP status ${statusCode}, expected ${check.expected_status || 200}`;
    }
  } catch (err) {
    statusCode = err.response?.status || 0;
    isSuccess = false;
    errorMessage = err.code ? `Network error: ${err.code}` : err.message;
  }

  const responseTimeMs = Date.now() - startTime;
  const now = new Date();

  // Log execution directly in Supabase
  const logEntry = {
    id: uuidv4(),
    health_check_id: check.id,
    status_code: statusCode,
    response_time_ms: responseTimeMs,
    is_success: isSuccess,
    error_message: errorMessage,
    checked_at: now.toISOString()
  };

  await client.from('health_check_logs').insert(logEntry);

  // Prepare check updates
  const wasDown = check.current_status === 'down';
  const updates = {
    last_checked_at: now.toISOString(),
    last_status_code: statusCode,
    last_response_time_ms: responseTimeMs
  };

  if (isSuccess) {
    updates.current_status = 'healthy';

    // Automated Recovery Notification
    if (wasDown && check.down_since) {
      const outageDurationMs = now.getTime() - new Date(check.down_since).getTime();
      const formattedDuration = formatDuration(outageDurationMs);

      console.log(`[HealthChecker] Service recovered: ${check.name} after ${formattedDuration}`);
      const recoveryMessage = `✅ [Dev Box RECOVERY]\nService: ${check.name}\nURL: ${check.endpoint_url}\nStatus: Back online (HTTP ${statusCode})\nTotal Outage: ${formattedDuration}\nRecovered At: ${now.toLocaleTimeString()}`;
      
      // Dispatch alert
      sendWhatsAppAlert(recoveryMessage).catch(console.error);
    }

    updates.consecutive_failures = 0;
    updates.down_since = null;
  } else {
    updates.current_status = 'down';
    const failures = (check.consecutive_failures || 0) + 1;
    updates.consecutive_failures = failures;

    if (!check.down_since) {
      updates.down_since = now.toISOString();
    }

    // Incident Throttling: trigger after 2 consecutive failures, with 60-minute cooldown
    const cooldownMs = 60 * 60 * 1000;
    const lastAlerted = check.last_alerted_at ? new Date(check.last_alerted_at).getTime() : 0;
    const timeSinceLastAlert = now.getTime() - lastAlerted;

    if (failures >= 2 && timeSinceLastAlert > cooldownMs) {
      updates.last_alerted_at = now.toISOString();
      const alertMsg = `🚨 [Dev Box INCIDENT ALERT]\nService: ${check.name}\nURL: ${check.endpoint_url}\nFailures: ${failures} consecutive\nError: ${errorMessage}\nStatus Code: ${statusCode}\nTime: ${now.toLocaleTimeString()}\n(Alert throttled for 60m)`;
      
      console.log(`[HealthChecker] Triggering incident alert for ${check.name}`);
      sendWhatsAppAlert(alertMsg).catch(console.error);
    }
  }

  await client.from('health_checks').update(updates).eq('id', check.id);

  return {
    checkId: check.id,
    name: check.name,
    currentStatus: updates.current_status,
    statusCode,
    responseTimeMs,
    isSuccess,
    errorMessage,
    consecutiveFailures: updates.consecutive_failures || 0
  };
}

/**
 * Execute all active health checks directly against Supabase DB
 */
export async function runAllDueHealthChecks() {
  const client = getSupabase();
  if (!client) return [];

  const { data: activeChecks, error } = await client
    .from('health_checks')
    .select('*')
    .eq('is_active', true)
    .eq('is_maintenance_mode', false);

  if (error || !activeChecks) return [];

  console.log(`[HealthChecker] Running checks for ${activeChecks.length} endpoints...`);

  const results = [];
  for (const check of activeChecks) {
    try {
      const res = await executeHealthCheck(check.id);
      if (res) results.push(res);
    } catch (err) {
      console.error(`[HealthChecker] Error running check ${check.name}:`, err.message);
    }
  }

  return results;
}
