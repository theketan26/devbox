import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';
import { calculateParity } from '../utils/parity.js';
import { exportDotEnv, exportJSON, exportDockerCompose, exportK8sSecret } from '../utils/exporter.js';
import { requireAuth } from '../middleware/auth.js';
import { saveRecordToSupabase, deleteRecordFromSupabase } from '../services/supabase.js';

const router = express.Router();

/**
 * List configs with optional filtering and decryption
 * GET /api/configs
 */
router.get('/', (req, res) => {
  const { projectId, applicationId, environment, decrypt } = req.query;
  let configs = db.data.configs_and_secrets;

  if (projectId) {
    configs = configs.filter(c => c.project_id === projectId);
  }
  if (applicationId) {
    configs = configs.filter(c => c.application_id === applicationId);
  }
  if (environment) {
    configs = configs.filter(c => c.environment === environment);
  }

  const result = configs.map(cfg => {
    const versions = db.data.config_versions
      .filter(v => v.config_id === cfg.id)
      .sort((a, b) => b.version_number - a.version_number);

    let decryptedValue = null;
    if (decrypt === 'true') {
      decryptedValue = decryptSecret(cfg.encrypted_value, cfg.iv, cfg.auth_tag);
    }

    return {
      ...cfg,
      decrypted_value: decryptedValue,
      versionsCount: versions.length,
      currentVersionNumber: versions.length > 0 ? versions[0].version_number : 1,
      versions: versions.map(v => ({
        id: v.id,
        version_number: v.version_number,
        created_at: v.created_at
      }))
    };
  });

  return res.json(result);
});

/**
 * Cross-environment parity checker
 * GET /api/configs/parity
 */
router.get('/parity', (req, res) => {
  const { projectId, applicationId } = req.query;
  let configs = db.data.configs_and_secrets;

  if (applicationId) {
    configs = configs.filter(c => c.application_id === applicationId);
  } else if (projectId) {
    configs = configs.filter(c => c.project_id === projectId);
  }

  const parity = calculateParity(configs);
  return res.json(parity);
});

/**
 * Multi-format configuration export
 * GET /api/configs/export
 */
router.get('/export', (req, res) => {
  const { projectId, applicationId, environment = 'production', format = 'dotenv', secretName = 'app-secret' } = req.query;

  let configs = db.data.configs_and_secrets.filter(c => c.environment === environment);
  if (applicationId) {
    configs = configs.filter(c => c.application_id === applicationId);
  } else if (projectId) {
    configs = configs.filter(c => c.project_id === projectId);
  }

  // Decrypt all values for export
  const decryptedMap = {};
  configs.forEach(cfg => {
    decryptedMap[cfg.id] = decryptSecret(cfg.encrypted_value, cfg.iv, cfg.auth_tag);
  });

  let output = '';
  let contentType = 'text/plain';

  switch (format.toLowerCase()) {
    case 'json':
      output = exportJSON(configs, decryptedMap);
      contentType = 'application/json';
      break;
    case 'docker':
    case 'docker-compose':
      output = exportDockerCompose(configs, decryptedMap);
      contentType = 'text/yaml';
      break;
    case 'k8s':
    case 'kubernetes':
      output = exportK8sSecret(configs, decryptedMap, secretName);
      contentType = 'text/yaml';
      break;
    case 'dotenv':
    default:
      output = exportDotEnv(configs, decryptedMap);
      contentType = 'text/plain';
      break;
  }

  res.setHeader('Content-Type', contentType);
  return res.send(output);
});

/**
 * Create config / secret with AES-256-GCM encryption
 * POST /api/configs
 */
router.post('/', requireAuth, (req, res) => {
  const { project_id, application_id, environment = 'production', environments, key, value, is_secret = true } = req.body;

  if (!project_id || !key) {
    return res.status(400).json({ error: 'project_id and key are required' });
  }

  const cleanKey = key.trim().toUpperCase();
  const plainValue = value !== undefined ? String(value) : '';
  const now = new Date().toISOString();

  // Support multi-select environments array or single environment string
  const targetEnvs = Array.isArray(environments) && environments.length > 0
    ? environments
    : [environment];

  const createdConfigs = [];

  for (const env of targetEnvs) {
    // Check if exists for same scope
    let config = db.data.configs_and_secrets.find(
      c => c.project_id === project_id &&
           c.application_id === (application_id || null) &&
           c.environment === env &&
           c.key === cleanKey
    );

    const { encryptedValue, iv, authTag } = encryptSecret(plainValue);

    if (config) {
      // If secret already exists in this environment, update value and record version
      const existingVersions = db.data.config_versions.filter(v => v.config_id === config.id);
      const nextVersion = existingVersions.length > 0
        ? Math.max(...existingVersions.map(v => v.version_number)) + 1
        : 1;

      config.encrypted_value = encryptedValue;
      config.iv = iv;
      config.auth_tag = authTag;
      config.is_secret = Boolean(is_secret);
      config.updated_at = now;

      db.data.config_versions.push({
        id: uuidv4(),
        config_id: config.id,
        version_number: nextVersion,
        encrypted_value: encryptedValue,
        iv,
        auth_tag: authTag,
        created_at: now
      });

      createdConfigs.push({ ...config, decrypted_value: plainValue, currentVersionNumber: nextVersion });
    } else {
      // Create new secret
      const configId = uuidv4();
      const newConfig = {
        id: configId,
        project_id,
        application_id: application_id || null,
        environment: env,
        key: cleanKey,
        encrypted_value: encryptedValue,
        iv,
        auth_tag: authTag,
        is_secret: Boolean(is_secret),
        created_at: now,
        updated_at: now
      };

      db.data.configs_and_secrets.push(newConfig);

      db.data.config_versions.push({
        id: uuidv4(),
        config_id: configId,
        version_number: 1,
        encrypted_value: encryptedValue,
        iv,
        auth_tag: authTag,
        created_at: now
      });

      createdConfigs.push({ ...newConfig, decrypted_value: plainValue, currentVersionNumber: 1 });
    }
  }

  db.save();

  // Persist to Supabase DB
  createdConfigs.forEach(cfg => {
    const { decrypted_value, currentVersionNumber, ...dbRecord } = cfg;
    saveRecordToSupabase('configs_and_secrets', dbRecord);
  });
  db.data.config_versions.forEach(v => {
    saveRecordToSupabase('config_versions', v);
  });

  if (targetEnvs.length === 1) {
    return res.status(201).json(createdConfigs[0]);
  }

  return res.status(201).json({
    success: true,
    created: createdConfigs,
    count: createdConfigs.length
  });
});

/**
 * Update config / secret with new version creation
 * PUT /api/configs/:id
 */
router.put('/:id', requireAuth, (req, res) => {
  const config = db.data.configs_and_secrets.find(c => c.id === req.params.id);
  if (!config) {
    return res.status(404).json({ error: 'Config not found' });
  }

  const { value, key, is_secret } = req.body;
  const now = new Date().toISOString();

  if (key) {
    config.key = key.trim().toUpperCase();
  }
  if (is_secret !== undefined) {
    config.is_secret = Boolean(is_secret);
  }

  if (value !== undefined) {
    const plainValue = String(value);
    const { encryptedValue, iv, authTag } = encryptSecret(plainValue);

    config.encrypted_value = encryptedValue;
    config.iv = iv;
    config.auth_tag = authTag;

    // Increment version
    const existingVersions = db.data.config_versions.filter(v => v.config_id === config.id);
    const nextVersionNumber = existingVersions.reduce((max, v) => Math.max(max, v.version_number), 0) + 1;

    db.data.config_versions.push({
      id: uuidv4(),
      config_id: config.id,
      version_number: nextVersionNumber,
      encrypted_value: encryptedValue,
      iv,
      auth_tag: authTag,
      created_at: now
    });
  }

  config.updated_at = now;
  db.save();
  saveRecordToSupabase('configs_and_secrets', config);

  return res.json(config);
});

/**
 * Rollback secret to prior version
 * POST /api/configs/:id/rollback
 */
router.post('/:id/rollback', requireAuth, (req, res) => {
  const config = db.data.configs_and_secrets.find(c => c.id === req.params.id);
  if (!config) {
    return res.status(404).json({ error: 'Config not found' });
  }

  const { versionNumber } = req.body;
  if (!versionNumber) {
    return res.status(400).json({ error: 'versionNumber is required' });
  }

  const targetVersion = db.data.config_versions.find(
    v => v.config_id === config.id && v.version_number === Number(versionNumber)
  );

  if (!targetVersion) {
    return res.status(404).json({ error: `Version ${versionNumber} not found for this config` });
  }

  const now = new Date().toISOString();
  // Restore encrypted fields
  config.encrypted_value = targetVersion.encrypted_value;
  config.iv = targetVersion.iv;
  config.auth_tag = targetVersion.auth_tag;
  config.updated_at = now;

  // Add rollback event as latest version
  const existingVersions = db.data.config_versions.filter(v => v.config_id === config.id);
  const nextVersionNumber = existingVersions.reduce((max, v) => Math.max(max, v.version_number), 0) + 1;

  db.data.config_versions.push({
    id: uuidv4(),
    config_id: config.id,
    version_number: nextVersionNumber,
    encrypted_value: targetVersion.encrypted_value,
    iv: targetVersion.iv,
    auth_tag: targetVersion.auth_tag,
    created_at: now
  });

  db.save();
  saveRecordToSupabase('configs_and_secrets', config);

  return res.json({
    success: true,
    message: `Restored version ${versionNumber} as new version ${nextVersionNumber}`,
    currentVersionNumber: nextVersionNumber,
    config
  });
});

/**
 * Delete config
 * DELETE /api/configs/:id
 */
router.delete('/:id', requireAuth, (req, res) => {
  const index = db.data.configs_and_secrets.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Config not found' });
  }

  db.data.configs_and_secrets.splice(index, 1);
  db.data.config_versions = db.data.config_versions.filter(v => v.config_id !== req.params.id);
  db.save();
  deleteRecordFromSupabase('configs_and_secrets', req.params.id);

  return res.json({ success: true, message: 'Config and version history deleted' });
});

/**
 * One-click .env bulk import
 * POST /api/configs/import
 */
router.post('/import', requireAuth, (req, res) => {
  const { project_id, application_id, environment = 'production', envContent } = req.body;

  if (!project_id || !envContent) {
    return res.status(400).json({ error: 'project_id and envContent are required' });
  }

  const lines = envContent.split(/\r?\n/);
  const imported = [];
  const now = new Date().toISOString();

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) return;

    const rawKey = trimmed.substring(0, eqIndex).trim().toUpperCase();
    let rawVal = trimmed.substring(eqIndex + 1).trim();

    // Strip enclosing single or double quotes
    if ((rawVal.startsWith('"') && rawVal.endsWith('"')) ||
        (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
      rawVal = rawVal.substring(1, rawVal.length - 1);
    }

    const { encryptedValue, iv, authTag } = encryptSecret(rawVal);

    // Check existing
    const existing = db.data.configs_and_secrets.find(
      c => c.project_id === project_id &&
           c.application_id === (application_id || null) &&
           c.environment === environment &&
           c.key === rawKey
    );

    if (existing) {
      existing.encrypted_value = encryptedValue;
      existing.iv = iv;
      existing.auth_tag = authTag;
      existing.updated_at = now;

      // Versioning
      const versions = db.data.config_versions.filter(v => v.config_id === existing.id);
      const nextVer = versions.reduce((max, v) => Math.max(max, v.version_number), 0) + 1;
      const versionRecord = {
        id: uuidv4(),
        config_id: existing.id,
        version_number: nextVer,
        encrypted_value: encryptedValue,
        iv,
        auth_tag: authTag,
        created_at: now
      };
      db.data.config_versions.push(versionRecord);
      saveRecordToSupabase('configs_and_secrets', existing);
      saveRecordToSupabase('config_versions', versionRecord);
      imported.push({ key: rawKey, action: 'updated', version: nextVer });
    } else {
      const configId = uuidv4();
      const newCfg = {
        id: configId,
        project_id,
        application_id: application_id || null,
        environment,
        key: rawKey,
        encrypted_value: encryptedValue,
        iv,
        auth_tag: authTag,
        is_secret: true,
        created_at: now,
        updated_at: now
      };
      const versionRecord = {
        id: uuidv4(),
        config_id: configId,
        version_number: 1,
        encrypted_value: encryptedValue,
        iv,
        auth_tag: authTag,
        created_at: now
      };
      db.data.configs_and_secrets.push(newCfg);
      db.data.config_versions.push(versionRecord);
      saveRecordToSupabase('configs_and_secrets', newCfg);
      saveRecordToSupabase('config_versions', versionRecord);
      imported.push({ key: rawKey, action: 'created', version: 1 });
    }
  });

  db.save();

  return res.json({
    success: true,
    totalProcessed: imported.length,
    results: imported
  });
});

export default router;
