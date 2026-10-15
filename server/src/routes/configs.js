import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';
import { calculateParity } from '../utils/parity.js';
import { exportDotEnv, exportJSON, exportDockerCompose, exportK8sSecret } from '../utils/exporter.js';
import { requireAuth } from '../middleware/auth.js';
import { getSupabase } from '../services/supabase.js';

const router = express.Router();

/**
 * List configs with optional filtering and decryption directly from Supabase
 * GET /api/configs
 */
router.get('/', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const { projectId, applicationId, environment, decrypt } = req.query;

  try {
    let query = client.from('configs_and_secrets').select('*').order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    if (applicationId) {
      query = query.eq('application_id', applicationId);
    }
    if (environment) {
      query = query.eq('environment', environment);
    }

    const { data: configs, error: cErr } = await query;
    if (cErr) throw cErr;

    const configList = configs || [];
    const configIds = configList.map(c => c.id);

    let versions = [];
    if (configIds.length > 0) {
      const { data: vData, error: vErr } = await client
        .from('config_versions')
        .select('id, config_id, version_number, created_at')
        .in('config_id', configIds)
        .order('version_number', { ascending: false });

      if (!vErr && vData) {
        versions = vData;
      }
    }

    const result = configList.map(cfg => {
      const cfgVersions = versions
        .filter(v => v.config_id === cfg.id)
        .sort((a, b) => b.version_number - a.version_number);

      let decryptedValue = null;
      if (decrypt === 'true') {
        decryptedValue = decryptSecret(cfg.encrypted_value, cfg.iv, cfg.auth_tag);
      }

      return {
        ...cfg,
        decrypted_value: decryptedValue,
        versionsCount: cfgVersions.length,
        currentVersionNumber: cfgVersions.length > 0 ? cfgVersions[0].version_number : 1,
        versions: cfgVersions.map(v => ({
          id: v.id,
          version_number: v.version_number,
          created_at: v.created_at
        }))
      };
    });

    return res.json(result);
  } catch (err) {
    console.error('GET /api/configs error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Cross-environment parity checker directly from Supabase
 * GET /api/configs/parity
 */
router.get('/parity', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const { projectId, applicationId } = req.query;

  try {
    let query = client.from('configs_and_secrets').select('*');

    if (applicationId) {
      query = query.eq('application_id', applicationId);
    } else if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: configs, error } = await query;
    if (error) throw error;

    const parity = calculateParity(configs || []);
    return res.json(parity);
  } catch (err) {
    console.error('GET /api/configs/parity error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Multi-format configuration export directly from Supabase
 * GET /api/configs/export
 */
router.get('/export', async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const { projectId, applicationId, environment = 'production', format = 'dotenv', secretName = 'app-secret' } = req.query;

  try {
    let query = client.from('configs_and_secrets').select('*').eq('environment', environment);

    if (applicationId) {
      query = query.eq('application_id', applicationId);
    } else if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: rawConfigs, error } = await query;
    if (error) throw error;

    const configs = rawConfigs || [];

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
  } catch (err) {
    console.error('GET /api/configs/export error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Create config / secret with AES-256-GCM encryption directly in Supabase
 * POST /api/configs
 */
router.post('/', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

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

  try {
    for (const env of targetEnvs) {
      // Check if exists for same scope in Supabase
      let existQuery = client.from('configs_and_secrets').select('*')
        .eq('project_id', project_id)
        .eq('environment', env)
        .eq('key', cleanKey);

      if (application_id) {
        existQuery = existQuery.eq('application_id', application_id);
      } else {
        existQuery = existQuery.is('application_id', null);
      }

      const { data: existingRecords, error: eErr } = await existQuery;
      if (eErr) throw eErr;

      const existingConfig = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null;
      const { encryptedValue, iv, authTag } = encryptSecret(plainValue);

      if (existingConfig) {
        // Find latest version number
        const { data: versions } = await client
          .from('config_versions')
          .select('version_number')
          .eq('config_id', existingConfig.id)
          .order('version_number', { ascending: false })
          .limit(1);

        const nextVersion = (versions && versions.length > 0) ? versions[0].version_number + 1 : 1;

        // Update existing record
        const { data: updatedConfig, error: uErr } = await client
          .from('configs_and_secrets')
          .update({
            encrypted_value: encryptedValue,
            iv,
            auth_tag: authTag,
            is_secret: Boolean(is_secret),
            updated_at: now
          })
          .eq('id', existingConfig.id)
          .select()
          .single();

        if (uErr) throw uErr;

        // Insert new version
        await client.from('config_versions').insert({
          id: uuidv4(),
          config_id: existingConfig.id,
          version_number: nextVersion,
          encrypted_value: encryptedValue,
          iv,
          auth_tag: authTag,
          created_at: now
        });

        createdConfigs.push({
          ...updatedConfig,
          decrypted_value: plainValue,
          currentVersionNumber: nextVersion
        });
      } else {
        // Create new secret
        const configId = uuidv4();
        const newRecord = {
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

        const { data: inserted, error: iErr } = await client
          .from('configs_and_secrets')
          .insert(newRecord)
          .select()
          .single();

        if (iErr) throw iErr;

        // Insert version 1
        await client.from('config_versions').insert({
          id: uuidv4(),
          config_id: configId,
          version_number: 1,
          encrypted_value: encryptedValue,
          iv,
          auth_tag: authTag,
          created_at: now
        });

        createdConfigs.push({
          ...inserted,
          decrypted_value: plainValue,
          currentVersionNumber: 1
        });
      }
    }

    if (targetEnvs.length === 1) {
      return res.status(201).json(createdConfigs[0]);
    }

    return res.status(201).json({
      success: true,
      created: createdConfigs,
      count: createdConfigs.length
    });
  } catch (err) {
    console.error('POST /api/configs error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Update config / secret with new version creation directly in Supabase
 * PUT /api/configs/:id
 */
router.put('/:id', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    const { data: config, error: fErr } = await client
      .from('configs_and_secrets')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fErr || !config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    const { value, key, is_secret } = req.body;
    const now = new Date().toISOString();
    const updates = { updated_at: now };

    if (key) {
      updates.key = key.trim().toUpperCase();
    }
    if (is_secret !== undefined) {
      updates.is_secret = Boolean(is_secret);
    }

    if (value !== undefined) {
      const plainValue = String(value);
      const { encryptedValue, iv, authTag } = encryptSecret(plainValue);

      updates.encrypted_value = encryptedValue;
      updates.iv = iv;
      updates.auth_tag = authTag;

      // Increment version
      const { data: versions } = await client
        .from('config_versions')
        .select('version_number')
        .eq('config_id', config.id)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersionNumber = (versions && versions.length > 0) ? versions[0].version_number + 1 : 1;

      await client.from('config_versions').insert({
        id: uuidv4(),
        config_id: config.id,
        version_number: nextVersionNumber,
        encrypted_value: encryptedValue,
        iv,
        auth_tag: authTag,
        created_at: now
      });
    }

    const { data: updatedRecord, error: uErr } = await client
      .from('configs_and_secrets')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (uErr) throw uErr;

    return res.json(updatedRecord);
  } catch (err) {
    console.error('PUT /api/configs/:id error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Rollback secret to prior version directly in Supabase
 * POST /api/configs/:id/rollback
 */
router.post('/:id/rollback', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const { versionNumber } = req.body;
  if (!versionNumber) {
    return res.status(400).json({ error: 'versionNumber is required' });
  }

  try {
    const { data: config, error: fErr } = await client
      .from('configs_and_secrets')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fErr || !config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    const { data: targetVersion, error: vErr } = await client
      .from('config_versions')
      .select('*')
      .eq('config_id', config.id)
      .eq('version_number', Number(versionNumber))
      .single();

    if (vErr || !targetVersion) {
      return res.status(404).json({ error: `Version ${versionNumber} not found for this config` });
    }

    const now = new Date().toISOString();

    // Query highest version number
    const { data: versions } = await client
      .from('config_versions')
      .select('version_number')
      .eq('config_id', config.id)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersionNumber = (versions && versions.length > 0) ? versions[0].version_number + 1 : 1;

    // Restore encrypted fields
    const { data: updatedConfig, error: uErr } = await client
      .from('configs_and_secrets')
      .update({
        encrypted_value: targetVersion.encrypted_value,
        iv: targetVersion.iv,
        auth_tag: targetVersion.auth_tag,
        updated_at: now
      })
      .eq('id', config.id)
      .select()
      .single();

    if (uErr) throw uErr;

    // Add rollback event as latest version
    await client.from('config_versions').insert({
      id: uuidv4(),
      config_id: config.id,
      version_number: nextVersionNumber,
      encrypted_value: targetVersion.encrypted_value,
      iv: targetVersion.iv,
      auth_tag: targetVersion.auth_tag,
      created_at: now
    });

    return res.json({
      success: true,
      message: `Restored version ${versionNumber} as new version ${nextVersionNumber}`,
      currentVersionNumber: nextVersionNumber,
      config: updatedConfig
    });
  } catch (err) {
    console.error('POST /api/configs/:id/rollback error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Delete config directly from Supabase
 * DELETE /api/configs/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  try {
    // Delete config_versions first (if not cascading)
    await client.from('config_versions').delete().eq('config_id', req.params.id);

    const { error } = await client
      .from('configs_and_secrets')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    return res.json({ success: true, message: 'Config and version history deleted' });
  } catch (err) {
    console.error('DELETE /api/configs/:id error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * One-click .env bulk import directly into Supabase DB
 * POST /api/configs/import
 */
router.post('/import', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const { project_id, application_id, environment = 'production', envContent } = req.body;

  if (!project_id || !envContent) {
    return res.status(400).json({ error: 'project_id and envContent are required' });
  }

  const lines = envContent.split(/\r?\n/);
  const imported = [];
  const now = new Date().toISOString();

  try {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex <= 0) continue;

      const rawKey = trimmed.substring(0, eqIndex).trim().toUpperCase();
      let rawVal = trimmed.substring(eqIndex + 1).trim();

      // Strip enclosing single or double quotes
      if ((rawVal.startsWith('"') && rawVal.endsWith('"')) ||
          (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
        rawVal = rawVal.substring(1, rawVal.length - 1);
      }

      const { encryptedValue, iv, authTag } = encryptSecret(rawVal);

      // Check existing in Supabase
      let checkQuery = client.from('configs_and_secrets').select('*')
        .eq('project_id', project_id)
        .eq('environment', environment)
        .eq('key', rawKey);

      if (application_id) {
        checkQuery = checkQuery.eq('application_id', application_id);
      } else {
        checkQuery = checkQuery.is('application_id', null);
      }

      const { data: existingRows } = await checkQuery;
      const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

      if (existing) {
        // Query latest version
        const { data: versions } = await client
          .from('config_versions')
          .select('version_number')
          .eq('config_id', existing.id)
          .order('version_number', { ascending: false })
          .limit(1);

        const nextVer = (versions && versions.length > 0) ? versions[0].version_number + 1 : 1;

        const { error: updErr } = await client.from('configs_and_secrets').update({
          encrypted_value: encryptedValue,
          iv,
          auth_tag: authTag,
          updated_at: now
        }).eq('id', existing.id);
        if (updErr) throw updErr;

        const { error: verErr } = await client.from('config_versions').insert({
          id: uuidv4(),
          config_id: existing.id,
          version_number: nextVer,
          encrypted_value: encryptedValue,
          iv,
          auth_tag: authTag,
          created_at: now
        });
        if (verErr) throw verErr;

        imported.push({ key: rawKey, action: 'updated', version: nextVer });
      } else {
        const configId = uuidv4();
        const { error: insErr } = await client.from('configs_and_secrets').insert({
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
        });
        if (insErr) throw insErr;

        const { error: vInsErr } = await client.from('config_versions').insert({
          id: uuidv4(),
          config_id: configId,
          version_number: 1,
          encrypted_value: encryptedValue,
          iv,
          auth_tag: authTag,
          created_at: now
        });
        if (vInsErr) throw vInsErr;

        imported.push({ key: rawKey, action: 'created', version: 1 });
      }
    }

    return res.json({
      success: true,
      totalProcessed: imported.length,
      results: imported
    });
  } catch (err) {
    console.error('POST /api/configs/import error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
