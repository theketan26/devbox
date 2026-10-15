import crypto from 'crypto';
import { config } from '../config/env.js';

function getKeyBuffer(customKey) {
  const keyString = customKey || config.aesMasterKey;
  if (/^[0-9a-fA-F]{64}$/.test(keyString)) {
    return Buffer.from(keyString, 'hex');
  }
  return crypto.createHash('sha256').update(keyString).digest();
}

/**
 * Encrypt plain text using AES-256-GCM
 * @param {string} text 
 * @param {string} [customKey]
 * @returns {{ encryptedValue: string, iv: string, authTag: string }}
 */
export function encryptSecret(text, customKey) {
  if (text === null || text === undefined) {
    return { encryptedValue: '', iv: '', authTag: '' };
  }
  const key = getKeyBuffer(customKey);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(String(text), 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedValue: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt cipher text using AES-256-GCM
 * @param {string} encryptedValue 
 * @param {string} ivHex 
 * @param {string} authTagHex 
 * @param {string} [customKey]
 * @returns {string}
 */
export function decryptSecret(encryptedValue, ivHex, authTagHex, customKey) {
  if (!encryptedValue) return '';
  try {
    const key = getKeyBuffer(customKey);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'hex')),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Failed to decrypt secret:', err.message);
    return '[DECRYPTION_ERROR]';
  }
}
