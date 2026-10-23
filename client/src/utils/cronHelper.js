/**
 * Cron Expression Utilities for Health Check Probing (Client)
 */

export const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *', intervalMinutes: 1, category: 'Minutes' },
  { label: 'Every 4 minutes', value: '*/4 * * * *', intervalMinutes: 4, category: 'Minutes' },
  { label: 'Every 5 minutes', value: '*/5 * * * *', intervalMinutes: 5, category: 'Minutes' },
  { label: 'Every 10 minutes', value: '*/10 * * * *', intervalMinutes: 10, category: 'Minutes' },
  { label: 'Every 15 minutes', value: '*/15 * * * *', intervalMinutes: 15, category: 'Minutes' },
  { label: 'Every 30 minutes', value: '*/30 * * * *', intervalMinutes: 30, category: 'Minutes' },
  { label: 'Hourly (Every hour at :00)', value: '0 * * * *', intervalMinutes: 60, category: 'Hourly' },
  { label: 'Every 2 hours', value: '0 */2 * * *', intervalMinutes: 120, category: 'Hourly' },
  { label: 'Every 6 hours', value: '0 */6 * * *', intervalMinutes: 360, category: 'Hourly' },
  { label: 'Every 12 hours', value: '0 */12 * * *', intervalMinutes: 720, category: 'Hourly' },
  { label: 'Daily at Midnight (00:00 UTC)', value: '0 0 * * *', intervalMinutes: 1440, category: 'Daily' },
  { label: 'Daily at 09:00 AM UTC', value: '0 9 * * *', intervalMinutes: 1440, category: 'Daily' },
  { label: 'Daily at 06:00 PM UTC', value: '0 18 * * *', intervalMinutes: 1440, category: 'Daily' },
  { label: 'Weekly on Sunday at Midnight (00:00 UTC)', value: '0 0 * * 0', intervalMinutes: 10080, category: 'Weekly' },
  { label: 'Weekly on Monday at 09:00 AM UTC', value: '0 9 * * 1', intervalMinutes: 10080, category: 'Weekly' },
  { label: 'Monthly on 1st at Midnight (00:00 UTC)', value: '0 0 1 * *', intervalMinutes: 43200, category: 'Monthly' },
  { label: 'Custom Cron Expression...', value: 'custom', intervalMinutes: null, category: 'Custom' }
];

export function isValidCron(cronExpr) {
  if (!cronExpr || typeof cronExpr !== 'string') return false;
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const validPattern = /^(\*|[0-9,\-\/]+)$/;
  return parts.every(part => validPattern.test(part));
}

export function normalizeCron(cronExpr) {
  if (!cronExpr || typeof cronExpr !== 'string') return null;
  const trimmed = cronExpr.trim().replace(/\s+/g, ' ');
  return isValidCron(trimmed) ? trimmed : null;
}

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

export function cronToIntervalMinutes(cronExpr) {
  const norm = normalizeCron(cronExpr);
  if (!norm) return 5;

  const matched = CRON_PRESETS.find(p => p.value === norm);
  if (matched && matched.intervalMinutes) return matched.intervalMinutes;

  const [minP, hourP, domP, , dowP] = norm.split(' ');

  if (minP.startsWith('*/') && hourP === '*' && domP === '*' && dowP === '*') {
    const step = parseInt(minP.replace('*/', ''), 10);
    return Math.max(1, step || 5);
  }
  if (hourP.startsWith('*/') && domP === '*' && dowP === '*') {
    const step = parseInt(hourP.replace('*/', ''), 10);
    return (step || 1) * 60;
  }
  if (minP === '0' && hourP === '*' && domP === '*' && dowP === '*') {
    return 60;
  }
  if (domP === '*' && dowP === '*' && !hourP.includes('*') && !minP.includes('*')) {
    return 1440;
  }
  if (domP === '*' && dowP !== '*' && !hourP.includes('*')) {
    return 10080;
  }
  if (domP !== '*' && !hourP.includes('*')) {
    return 43200;
  }
  return 5;
}

export function describeCron(cronExpr) {
  const norm = normalizeCron(cronExpr);
  if (!norm) return 'Unknown Schedule';

  const matched = CRON_PRESETS.find(p => p.value === norm && p.value !== 'custom');
  if (matched) return matched.label;

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

  return `Custom: ${norm}`;
}

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

export function getNextCronRun(cronExpr, fromDate = new Date()) {
  const norm = normalizeCron(cronExpr);
  if (!norm) return null;

  const [minP, hourP, domP, monP, dowP] = norm.split(' ');
  const base = new Date(fromDate);
  const cursor = new Date(isNaN(base.getTime()) ? Date.now() : base.getTime());

  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

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
