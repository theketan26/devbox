/**
 * Cron Expression Utilities for Health Check Probing
 * Supports standard 5-part cron syntax: minute hour day-of-month month day-of-week
 */

export const CRON_PRESETS = [
  { label: 'Every minute (* * * * *)', value: '* * * * *', intervalMinutes: 1, category: 'Minute' },
  { label: 'Every 4 minutes (*/4 * * * *)', value: '*/4 * * * *', intervalMinutes: 4, category: 'Minute' },
  { label: 'Every 5 minutes (*/5 * * * *)', value: '*/5 * * * *', intervalMinutes: 5, category: 'Minute' },
  { label: 'Every 10 minutes (*/10 * * * *)', value: '*/10 * * * *', intervalMinutes: 10, category: 'Minute' },
  { label: 'Every 15 minutes (*/15 * * * *)', value: '*/15 * * * *', intervalMinutes: 15, category: 'Minute' },
  { label: 'Every 30 minutes (*/30 * * * *)', value: '*/30 * * * *', intervalMinutes: 30, category: 'Minute' },
  { label: 'Hourly (0 * * * *)', value: '0 * * * *', intervalMinutes: 60, category: 'Hourly' },
  { label: 'Every 2 hours (0 */2 * * *)', value: '0 */2 * * *', intervalMinutes: 120, category: 'Hourly' },
  { label: 'Every 6 hours (0 */6 * * *)', value: '0 */6 * * *', intervalMinutes: 360, category: 'Hourly' },
  { label: 'Every 12 hours (0 */12 * * *)', value: '0 */12 * * *', intervalMinutes: 720, category: 'Hourly' },
  { label: 'Daily at Midnight 00:00 UTC (0 0 * * *)', value: '0 0 * * *', intervalMinutes: 1440, category: 'Daily' },
  { label: 'Daily at 09:00 AM UTC (0 9 * * *)', value: '0 9 * * *', intervalMinutes: 1440, category: 'Daily' },
  { label: 'Daily at 06:00 PM UTC (0 18 * * *)', value: '0 18 * * *', intervalMinutes: 1440, category: 'Daily' },
  { label: 'Weekly on Sunday 00:00 UTC (0 0 * * 0)', value: '0 0 * * 0', intervalMinutes: 10080, category: 'Weekly' },
  { label: 'Weekly on Monday 09:00 AM UTC (0 9 * * 1)', value: '0 9 * * 1', intervalMinutes: 10080, category: 'Weekly' },
  { label: 'Monthly on 1st at 00:00 UTC (0 0 1 * *)', value: '0 0 1 * *', intervalMinutes: 43200, category: 'Monthly' }
];

/**
 * Validate standard 5-part cron pattern
 * @param {string} cronExpr
 * @returns {boolean}
 */
export function isValidCron(cronExpr) {
  if (!cronExpr || typeof cronExpr !== 'string') return false;
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minP, hourP, domP, monP, dowP] = parts;
  const validPattern = /^(\*|[0-9,\-\/]+)$/;
  return (
    validPattern.test(minP) &&
    validPattern.test(hourP) &&
    validPattern.test(domP) &&
    validPattern.test(monP) &&
    validPattern.test(dowP)
  );
}

/**
 * Clean and format cron expression
 */
export function normalizeCron(cronExpr) {
  if (!cronExpr || typeof cronExpr !== 'string') return null;
  const trimmed = cronExpr.trim().replace(/\s+/g, ' ');
  return isValidCron(trimmed) ? trimmed : null;
}

/**
 * Convert numeric minutes into cron expression
 * @param {number} intervalMinutes
 * @returns {string}
 */
export function intervalToCronExpression(intervalMinutes) {
  const minutes = Math.max(1, Number(intervalMinutes) || 5);
  if (minutes === 1) return '* * * * *';
  if (minutes < 60) return `*/${minutes} * * * *`;
  if (minutes === 60) return '0 * * * *';
  if (minutes % 60 === 0 && minutes < 1440) {
    const hours = minutes / 60;
    return `0 */${hours} * * *`;
  }
  if (minutes === 1440) return '0 0 * * *';
  if (minutes === 10080) return '0 0 * * 0';
  if (minutes === 43200) return '0 0 1 * *';
  return `0 * * * *`;
}

/**
 * Convert cron expression into approximate integer interval_minutes
 * @param {string} cronExpr
 * @returns {number}
 */
export function cronToIntervalMinutes(cronExpr) {
  const norm = normalizeCron(cronExpr);
  if (!norm) return 5;

  const matched = CRON_PRESETS.find(p => p.value === norm);
  if (matched) return matched.intervalMinutes;

  const [minP, hourP, domP, , dowP] = norm.split(' ');

  // Every X minutes
  if (minP.startsWith('*/') && hourP === '*' && domP === '*' && dowP === '*') {
    const step = parseInt(minP.replace('*/', ''), 10);
    return Math.max(1, step || 5);
  }

  // Hourly or Every X hours
  if (hourP.startsWith('*/') && domP === '*' && dowP === '*') {
    const step = parseInt(hourP.replace('*/', ''), 10);
    return (step || 1) * 60;
  }
  if (minP === '0' && hourP === '*' && domP === '*' && dowP === '*') {
    return 60;
  }

  // Daily
  if (domP === '*' && dowP === '*' && !hourP.includes('*') && !minP.includes('*')) {
    return 1440;
  }

  // Weekly
  if (domP === '*' && dowP !== '*' && !hourP.includes('*')) {
    return 10080;
  }

  // Monthly
  if (domP !== '*' && !hourP.includes('*')) {
    return 43200;
  }

  return 5;
}

/**
 * Human-readable description of a cron expression
 * @param {string} cronExpr
 * @returns {string}
 */
export function describeCron(cronExpr) {
  const norm = normalizeCron(cronExpr);
  if (!norm) return 'Unknown Schedule';

  const matched = CRON_PRESETS.find(p => p.value === norm);
  if (matched) return matched.label.replace(/\s*\([^)]*\)$/, '');

  const [minP, hourP, domP, monP, dowP] = norm.split(' ');

  if (norm === '* * * * *') return 'Every minute';
  if (minP.startsWith('*/') && hourP === '*' && domP === '*' && dowP === '*') {
    return `Every ${minP.slice(2)} minutes`;
  }
  if (minP === '0' && hourP.startsWith('*/') && domP === '*' && dowP === '*') {
    return `Every ${hourP.slice(2)} hours`;
  }
  if (minP === '0' && hourP === '*' && domP === '*' && dowP === '*') {
    return 'Hourly at minute 0';
  }
  if (domP === '*' && dowP === '*' && monP === '*') {
    return `Daily at ${hourP.padStart(2, '0')}:${minP.padStart(2, '0')} UTC`;
  }
  if (domP === '*' && dowP !== '*' && monP === '*') {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dName = dayNames[Number(dowP)] || `Day ${dowP}`;
    return `Weekly on ${dName} at ${hourP.padStart(2, '0')}:${minP.padStart(2, '0')} UTC`;
  }
  if (domP !== '*' && monP === '*') {
    return `Monthly on day ${domP} at ${hourP.padStart(2, '0')}:${minP.padStart(2, '0')} UTC`;
  }

  return `Custom (${norm})`;
}

/**
 * Internal field matcher for cron evaluation
 */
function fieldMatches(val, pattern) {
  if (pattern === '*') return true;
  for (const part of pattern.split(',')) {
    if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      let min = 0;
      if (range !== '*') min = parseInt(range, 10);
      if (step > 0 && (val - min) % step === 0 && val >= min) return true;
    } else if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (val >= start && val <= end) return true;
    } else {
      if (parseInt(part, 10) === val) return true;
    }
  }
  return false;
}

/**
 * Calculate the next execution Date of a cron expression from a given date
 * @param {string} cronExpr
 * @param {Date|string|number} fromDate
 * @returns {Date|null}
 */
export function getNextCronRun(cronExpr, fromDate = new Date()) {
  const norm = normalizeCron(cronExpr);
  if (!norm) return null;

  const [minP, hourP, domP, monP, dowP] = norm.split(' ');
  const base = new Date(fromDate);
  const cursor = new Date(isNaN(base.getTime()) ? Date.now() : base.getTime());

  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

  // Search ahead up to 35 days (50,400 minutes)
  for (let m = 0; m < 50400; m++) {
    const min = cursor.getUTCMinutes();
    const hour = cursor.getUTCHours();
    const dom = cursor.getUTCDate();
    const mon = cursor.getUTCMonth() + 1;
    const dow = cursor.getUTCDay();

    const dowMatches = fieldMatches(dow, dowP) || (dow === 0 && fieldMatches(7, dowP));

    if (
      fieldMatches(min, minP) &&
      fieldMatches(hour, hourP) &&
      fieldMatches(dom, domP) &&
      fieldMatches(mon, monP) &&
      dowMatches
    ) {
      return cursor;
    }

    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }

  return null;
}

/**
 * Check if a health check probe is due based on schedule and last checked timestamp
 * @param {string} cronExpr
 * @param {string|Date|null} lastCheckedAt
 * @param {Date} now
 * @returns {boolean}
 */
export function isCheckDue(cronExpr, lastCheckedAt, now = new Date()) {
  if (!lastCheckedAt) return true;

  const norm = normalizeCron(cronExpr);
  if (!norm) return true;

  const lastCheckedDate = new Date(lastCheckedAt);
  if (isNaN(lastCheckedDate.getTime())) return true;

  const nextRun = getNextCronRun(norm, lastCheckedDate);
  if (!nextRun) return true;

  return now.getTime() >= nextRun.getTime();
}
