import express from 'express';
import { db } from '../db/index.js';
import { decryptSecret } from '../utils/crypto.js';
import { exportDotEnv } from '../utils/exporter.js';
import { requireCliKey } from '../middleware/auth.js';

const router = express.Router();

/**
 * Local CLI utility endpoint
 * GET /api/cli/pull
 */
router.get('/pull', requireCliKey, (req, res) => {
  const { projectId, applicationId, environment = 'development', format = 'dotenv' } = req.query;

  let configs = db.data.configs_and_secrets.filter(c => c.environment === environment);

  if (applicationId) {
    configs = configs.filter(c => c.application_id === applicationId);
  } else if (projectId) {
    configs = configs.filter(c => c.project_id === projectId);
  }

  const decryptedMap = {};
  configs.forEach(c => {
    decryptedMap[c.id] = decryptSecret(c.encrypted_value, c.iv, c.auth_tag);
  });

  if (format === 'json') {
    const jsonResult = {};
    configs.forEach(c => {
      jsonResult[c.key] = decryptedMap[c.id];
    });
    return res.json(jsonResult);
  }

  const dotEnvContent = exportDotEnv(configs, decryptedMap);
  res.setHeader('Content-Type', 'text/plain');
  return res.send(dotEnvContent);
});

export default router;
