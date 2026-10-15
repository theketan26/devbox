import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { config } from './config/env.js';
import { db } from './db/index.js';
import { runAllDueHealthChecks } from './services/healthChecker.js';
import { syncHealthChecksWithPgCron, syncAllFromSupabase } from './services/supabase.js';

import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import applicationsRouter from './routes/applications.js';
import configsRouter from './routes/configs.js';
import cliRouter from './routes/cli.js';
import expirationsRouter from './routes/expirations.js';
import linksRouter from './routes/links.js';
import healthChecksRouter from './routes/healthChecks.js';
import telemetryRouter from './routes/telemetry.js';
import whatsappRouter from './routes/whatsapp.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api') && !req.path.includes('/telemetry')) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/configs', configsRouter);
app.use('/api/cli', cliRouter);
app.use('/api/expirations', expirationsRouter);
app.use('/api/links', linksRouter);
app.use('/api/health-checks', healthChecksRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/whatsapp', whatsappRouter);

// Supabase pg_cron direct alias matching plan.md
app.get('/api/cron/health-check', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = req.query.secret || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

  if (token && token !== config.cronSecret) {
    return res.status(403).json({ error: 'Invalid cron secret' });
  }

  const results = await runAllDueHealthChecks();
  return res.json({
    success: true,
    source: 'pg_cron_runner',
    executedCount: results.length,
    timestamp: new Date().toISOString()
  });
});

// Global Dashboard Metrics Aggregator
app.get('/api/dashboard/stats', (req, res) => {
  const totalProjects = db.data.projects.length;
  const totalApplications = db.data.applications.length;
  const totalConfigs = db.data.configs_and_secrets.length;
  const totalHealthChecks = db.data.health_checks.length;

  const healthyChecks = db.data.health_checks.filter(h => h.current_status === 'healthy').length;
  const downChecks = db.data.health_checks.filter(h => h.current_status === 'down').length;
  const maintenanceChecks = db.data.health_checks.filter(h => h.is_maintenance_mode).length;

  // Healthy apps: all probes healthy (none down)
  const healthyApplications = db.data.applications.filter(app => {
    const appChecks = db.data.health_checks.filter(h => h.application_id === app.id);
    return appChecks.length > 0 && appChecks.every(h => h.current_status === 'healthy');
  }).length;

  // Healthy projects: every app in project is healthy
  const healthyProjects = db.data.projects.filter(proj => {
    const projApps = db.data.applications.filter(a => a.project_id === proj.id);
    if (projApps.length === 0) return true;
    return projApps.every(app => {
      const appChecks = db.data.health_checks.filter(h => h.application_id === app.id);
      return appChecks.length > 0 && appChecks.every(h => h.current_status === 'healthy');
    });
  }).length;

  // Urgent expirations (next 14 days)
  const now = Date.now();
  const urgentExpirations = db.data.credential_expirations.filter(e => {
    const diffDays = Math.ceil((new Date(e.expires_at).getTime() - now) / (1000 * 60 * 60 * 24));
    return diffDays <= (e.alert_days_before || 14);
  });

  // Recent logs
  const recentLogs = [...db.data.health_check_logs]
    .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())
    .slice(0, 8);

  return res.json({
    totalProjects,
    totalApplications,
    totalConfigs,
    totalHealthChecks,
    health: {
      healthy: healthyChecks,
      down: downChecks,
      maintenance: maintenanceChecks
    },
    urgentExpirationsCount: urgentExpirations.length,
    healthyApplications,
    healthyProjects,
    recentLogs
  });
});

// Root API Health Status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    app: 'Dev Box Master API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Serve Frontend Client Static Assets (Production / Docker / Render)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const altDistPath = path.resolve(__dirname, '../client/dist');
const localPublicPath = path.resolve(__dirname, '../public');

const staticDir = fs.existsSync(clientDistPath)
  ? clientDistPath
  : fs.existsSync(altDistPath)
  ? altDistPath
  : fs.existsSync(localPublicPath)
  ? localPublicPath
  : null;

if (staticDir) {
  console.log(`[Dev Box Server] Serving frontend static assets from: ${staticDir}`);
  app.use(express.static(staticDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

// 404 Handler for unhandled API endpoints
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// Start Express Server (only if not running under test runner)
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(config.port, () => {
    console.log(`[Dev Box Server] Listening on http://localhost:${config.port}`);
    syncAllFromSupabase().catch(err => {
      console.warn('[Supabase DB] Startup database sync notice:', err.message);
    });
    syncHealthChecksWithPgCron().catch(err => {
      console.warn('[Supabase pg_cron] Startup sync error:', err.message);
    });
  });

  // Background Health Check Timer (checks every 5 minutes in background)
  const cronIntervalMs = 5 * 60 * 1000;
  setInterval(() => {
    runAllDueHealthChecks().catch(err => {
      console.error('[HealthChecker] Background interval error:', err.message);
    });
  }, cronIntervalMs);
}

export default app;

