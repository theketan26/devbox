import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { sendWhatsAppAlert } from '../utils/whatsapp.js';
import { saveRecordToSupabase } from './supabase.js';

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
 * Execute a single health check by ID
 * @param {string} checkId
 */
export async function executeHealthCheck(checkId) {
  const check = db.data.health_checks.find(c => c.id === checkId);
  if (!check) return null;

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
    const responseTime = Date.now() - startTime;

    // Validate Status Code
    if (statusCode === (check.expected_status || 200)) {
      isSuccess = true;
      // Validate Expected JSON Payload if configured
      if (check.expected_json_payload && Object.keys(check.expected_json_payload).length > 0) {
        if (!matchesExpectedJson(res.data, check.expected_json_payload)) {
          isSuccess = false;
          errorMessage = `Response body did not match expected JSON payload pattern`;
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

  // Log execution
  const logEntry = {
    id: uuidv4(),
    health_check_id: check.id,
    status_code: statusCode,
    response_time_ms: responseTimeMs,
    is_success: isSuccess,
    error_message: errorMessage,
    checked_at: now.toISOString()
  };
  db.data.health_check_logs.push(logEntry);
  saveRecordToSupabase('health_check_logs', logEntry);

  // Keep logs at max 50 per check to prevent bloat
  const checkLogs = db.data.health_check_logs.filter(l => l.health_check_id === check.id);
  if (checkLogs.length > 50) {
    const excess = checkLogs.length - 50;
    const toRemoveIds = new Set(checkLogs.slice(0, excess).map(l => l.id));
    db.data.health_check_logs = db.data.health_check_logs.filter(l => !toRemoveIds.has(l.id));
  }

  // Handle state transitions, alert throttling, and recovery
  const wasDown = check.current_status === 'down';
  check.last_checked_at = now.toISOString();
  check.last_status_code = statusCode;
  check.last_response_time_ms = responseTimeMs;

  if (isSuccess) {
    check.current_status = 'healthy';

    // Automated Recovery Notification
    if (wasDown && check.down_since) {
      const outageDurationMs = now.getTime() - new Date(check.down_since).getTime();
      const formattedDuration = formatDuration(outageDurationMs);

      console.log(`[HealthChecker] Service recovered: ${check.name} after ${formattedDuration}`);
      const recoveryMessage = `✅ [Dev Box RECOVERY]\nService: ${check.name}\nURL: ${check.endpoint_url}\nStatus: Back online (HTTP ${statusCode})\nTotal Outage: ${formattedDuration}\nRecovered At: ${now.toLocaleTimeString()}`;
      
      // Dispatch alert
      sendWhatsAppAlert(recoveryMessage).catch(console.error);
    }

    check.consecutive_failures = 0;
    check.down_since = null;
  } else {
    check.current_status = 'down';
    check.consecutive_failures = (check.consecutive_failures || 0) + 1;

    if (!check.down_since) {
      check.down_since = now.toISOString();
    }

    // Incident Throttling: trigger after 2 consecutive failures, with 60-minute cooldown
    const cooldownMs = 60 * 60 * 1000;
    const lastAlerted = check.last_alerted_at ? new Date(check.last_alerted_at).getTime() : 0;
    const timeSinceLastAlert = now.getTime() - lastAlerted;

    if (check.consecutive_failures >= 2 && timeSinceLastAlert > cooldownMs) {
      check.last_alerted_at = now.toISOString();
      const alertMsg = `🚨 [Dev Box INCIDENT ALERT]\nService: ${check.name}\nURL: ${check.endpoint_url}\nFailures: ${check.consecutive_failures} consecutive\nError: ${errorMessage}\nStatus Code: ${statusCode}\nTime: ${now.toLocaleTimeString()}\n(Alert throttled for 60m)`;
      
      console.log(`[HealthChecker] Triggering incident alert for ${check.name}`);
      sendWhatsAppAlert(alertMsg).catch(console.error);
    }
  }

  db.save();
  saveRecordToSupabase('health_checks', check);

  return {
    checkId: check.id,
    name: check.name,
    currentStatus: check.current_status,
    statusCode,
    responseTimeMs,
    isSuccess,
    errorMessage,
    consecutiveFailures: check.consecutive_failures
  };
}

/**
 * Execute all active health checks (invoked by cron or background runner)
 */
export async function runAllDueHealthChecks() {
  const activeChecks = db.data.health_checks.filter(c => c.is_active && !c.is_maintenance_mode);
  console.log(`[HealthChecker] Running checks for ${activeChecks.length} endpoints...`);

  const results = [];
  for (const check of activeChecks) {
    try {
      const res = await executeHealthCheck(check.id);
      results.push(res);
    } catch (err) {
      console.error(`[HealthChecker] Error running check ${check.name}:`, err.message);
    }
  }

  return results;
}
