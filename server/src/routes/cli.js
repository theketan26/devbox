import express from 'express';
import { decryptSecret } from '../utils/crypto.js';
import { exportDotEnv } from '../utils/exporter.js';
import { requireCliKey } from '../middleware/auth.js';
import { getSupabase } from '../services/supabase.js';

const router = express.Router();

/**
 * Local CLI utility endpoint directly from Supabase DB
 * GET /api/cli/pull
 */
router.get('/pull', requireCliKey, async (req, res) => {
  const client = getSupabase();
  if (!client) return res.status(500).json({ error: 'Database client not initialized' });

  const { projectId, applicationId, environment = 'development', format = 'dotenv' } = req.query;

  try {
    let query = client.from('configs_and_secrets').select('*').eq('environment', environment);

    if (applicationId) {
      query = query.eq('application_id', applicationId);
    } else if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: configs, error } = await query;
    if (error) throw error;

    const list = configs || [];
    const decryptedMap = {};
    list.forEach(c => {
      decryptedMap[c.id] = decryptSecret(c.encrypted_value, c.iv, c.auth_tag);
    });

    if (format === 'json') {
      const jsonResult = {};
      list.forEach(c => {
        jsonResult[c.key] = decryptedMap[c.id];
      });
      return res.json(jsonResult);
    }

    const dotEnvContent = exportDotEnv(list, decryptedMap);
    res.setHeader('Content-Type', 'text/plain');
    return res.send(dotEnvContent);
  } catch (err) {
    console.error('GET /api/cli/pull error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
