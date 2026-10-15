import express from 'express';
import { config } from '../config/env.js';
import { getWhatsAppStatus, sendWhatsAppAlert } from '../utils/whatsapp.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Check WhatsApp microservice connection status
 * GET /api/whatsapp/status
 */
router.get('/status', async (req, res) => {
  const status = await getWhatsAppStatus();
  return res.json({
    ...status,
    configuredUrl: config.whatsappServerUrl,
    targetRecipient: config.whatsappRecipient
  });
});

/**
 * Dispatch test WhatsApp alert message
 * POST /api/whatsapp/test
 */
router.post('/test', requireAuth, async (req, res) => {
  const { message, recipient } = req.body;
  const testMessage = message || `🔔 [Dev Box Test Alert]\nDispatched at: ${new Date().toLocaleString()}\nWhatsApp Web integration verified successfully.`;

  const result = await sendWhatsAppAlert(testMessage, recipient);
  return res.json(result);
});

export default router;
