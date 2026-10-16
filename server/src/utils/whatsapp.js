import axios from 'axios';
import { config } from '../config/env.js';

/**
 * Get WhatsApp client connection status from microservice
 * @returns {Promise<{ online: boolean, state: string, details?: any, error?: string }>}
 */
export async function getWhatsAppStatus() {
  try {
    const res = await axios.get(`${config.whatsappServerUrl}/api/status`, {
      headers: {
        'x-api-key': config.whatsappServerSecret
      },
      timeout: 3000
    });
    return {
      online: true,
      state: res.data.state || res.data.status || 'CONNECTED',
      details: res.data
    };
  } catch (err) {
    return {
      online: false,
      state: 'DISCONNECTED',
      error: err.code === 'ECONNREFUSED' ? 'WhatsApp microservice is offline' : err.message
    };
  }
}

/**
 * Send WhatsApp alert message via custom microservice
 * @param {string} message
 * @param {string} [recipient]
 * @returns {Promise<{ success: boolean, messageId?: string, timestamp?: string, error?: string }>}
 */
export async function sendWhatsAppAlert(message, recipient) {
  const targetRecipient = recipient || config.whatsappRecipient || '120363431013330373@g.us';
  console.log(`[WhatsApp Dispatcher] Sending alert to ${targetRecipient}:`, message);

  try {
    const res = await axios.post(
      `${config.whatsappServerUrl}/api/sendText`,
      {
        chatId: targetRecipient,
        id: null,
        mentions: null,
        reply_to: null,
        text: message,
        linkPreview: true,
        linkPreviewHighQuality: false,
        session: 'testing'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.whatsappServerSecret
        },
        timeout: 6000
      }
    );

    console.log('[WhatsApp Dispatcher] Alert successfully dispatched:', res.data);
    return {
      success: true,
      messageId: res.data.messageId || `msg_${Date.now()}`,
      timestamp: res.data.timestamp || new Date().toISOString()
    };
  } catch (err) {
    console.warn('[WhatsApp Dispatcher] Alert dispatch failed:', err.message);
    // In local development or when microservice is booting, provide graceful simulation log
    return {
      success: false,
      simulated: true,
      error: err.response?.data?.error || err.message,
      note: 'Message logged locally. Ensure whatsapp-server is active on configured port.'
    };
  }
}
