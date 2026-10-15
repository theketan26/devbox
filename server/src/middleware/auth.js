import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireCliKey(req, res, next) {
  const cliKey = req.headers['x-devbox-master-key'] || req.query.apiKey;
  if (!cliKey || cliKey !== config.cliMasterKey) {
    return res.status(403).json({ error: 'Forbidden: Invalid DEVBOX_CLI_MASTER_KEY' });
  }
  next();
}

export function requireCronSecret(req, res, next) {
  const authHeader = req.headers.authorization;
  const cronKey = req.query.secret || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
  
  if (!cronKey || cronKey !== config.cronSecret) {
    return res.status(403).json({ error: 'Forbidden: Invalid CRON_SECRET' });
  }
  next();
}
