import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Ingestion endpoint for deployed applications
 * POST /api/telemetry/ingest
 */
router.post('/ingest', (req, res) => {
  const token = req.headers['x-telemetry-token'] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

  if (!token) {
    return res.status(401).json({ error: 'Missing telemetry token in x-telemetry-token or Authorization header' });
  }

  const app = db.data.applications.find(a => a.telemetry_token === token);
  if (!app) {
    return res.status(403).json({ error: 'Invalid telemetry token' });
  }

  const {
    memory_rss_mb,
    memory_heap_mb,
    uptime_seconds,
    db_active_connections,
    cpu_usage_pct
  } = req.body;

  const entry = {
    id: uuidv4(),
    application_id: app.id,
    memory_rss_mb: Number(memory_rss_mb) || 0,
    memory_heap_mb: Number(memory_heap_mb) || 0,
    uptime_seconds: Number(uptime_seconds) || 0,
    db_active_connections: Number(db_active_connections) || 0,
    cpu_usage_pct: Number(cpu_usage_pct) || 0,
    created_at: new Date().toISOString()
  };

  db.data.application_telemetry.push(entry);

  // Prune history per app to max 100 entries to prevent memory leak
  const appMetrics = db.data.application_telemetry.filter(t => t.application_id === app.id);
  if (appMetrics.length > 100) {
    const excess = appMetrics.length - 100;
    const toRemove = new Set(appMetrics.slice(0, excess).map(t => t.id));
    db.data.application_telemetry = db.data.application_telemetry.filter(t => !toRemove.has(t.id));
  }

  db.save();

  return res.status(201).json({
    success: true,
    application: app.name,
    recordedAt: entry.created_at
  });
});

/**
 * Get telemetry history for application dashboard charts
 * GET /api/telemetry/:applicationId
 */
router.get('/:applicationId', (req, res) => {
  const metrics = db.data.application_telemetry
    .filter(t => t.application_id === req.params.applicationId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return res.json(metrics);
});

/**
 * Helper to simulate metric ingestion directly from UI
 * POST /api/telemetry/:applicationId/simulate
 */
router.post('/:applicationId/simulate', requireAuth, (req, res) => {
  const app = db.data.applications.find(a => a.id === req.params.applicationId);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const lastEntry = db.data.application_telemetry
    .filter(t => t.application_id === app.id)
    .pop();

  const baseRss = lastEntry ? lastEntry.memory_rss_mb : 150;
  const baseHeap = lastEntry ? lastEntry.memory_heap_mb : 85;
  const baseUptime = lastEntry ? lastEntry.uptime_seconds + 60 : 3600;

  const entry = {
    id: uuidv4(),
    application_id: app.id,
    memory_rss_mb: +(baseRss + (Math.random() * 10 - 5)).toFixed(2),
    memory_heap_mb: +(baseHeap + (Math.random() * 8 - 4)).toFixed(2),
    uptime_seconds: baseUptime,
    db_active_connections: Math.max(1, Math.floor(10 + (Math.random() * 6 - 3))),
    cpu_usage_pct: +(15 + Math.random() * 25).toFixed(2),
    created_at: new Date().toISOString()
  };

  db.data.application_telemetry.push(entry);
  db.save();

  return res.status(201).json(entry);
});

export default router;
