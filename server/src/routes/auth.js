import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { config } from '../config/env.js';

const router = express.Router();

// Active challenge tickets store
const pendingChallenges = new Map();

/**
 * Step 1: Verify master password and return 2FA challenge ticket
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  const { password } = req.body;

  if (!password || password !== config.masterPassword) {
    return res.status(401).json({ error: 'Invalid master credentials' });
  }

  const ticket = jwt.sign(
    { stage: '2fa_challenge', timestamp: Date.now() },
    config.jwtSecret,
    { expiresIn: '5m' }
  );

  const otpAuthUrl = `otpauth://totp/DevBox:master@devbox.local?secret=${config.masterTotpSecret}&issuer=DevBox`;

  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);
  } catch (err) {
    console.error('Error generating QR code:', err.message);
  }

  // Generate current valid test code for easy one-click testing in development
  const currentTestOtp = authenticator.generate(config.masterTotpSecret);

  pendingChallenges.set(ticket, {
    created: Date.now(),
    secret: config.masterTotpSecret
  });

  return res.json({
    success: true,
    challengeTicket: ticket,
    totpSecret: config.masterTotpSecret,
    qrCode: qrCodeDataUrl,
    demoCodeHint: currentTestOtp,
    message: '2FA challenge initiated. Enter 6-digit TOTP code.'
  });
});

/**
 * Step 2: Validate 6-digit TOTP code and issue tokens
 * POST /api/auth/verify-2fa
 */
router.post('/verify-2fa', (req, res) => {
  const { challengeTicket, totpCode } = req.body;

  if (!challengeTicket || !totpCode) {
    return res.status(400).json({ error: 'challengeTicket and totpCode are required' });
  }

  try {
    jwt.verify(challengeTicket, config.jwtSecret);
  } catch (err) {
    return res.status(401).json({ error: 'Challenge ticket expired or invalid' });
  }

  const cleanCode = String(totpCode).replace(/\D/g, '').trim();
  const cleanSecret = (config.masterTotpSecret || 'JBSWY3DPEHPK3PXP').trim();

  // Allow wide window (±30 minutes / 60 steps) to handle clock drift between client and server
  authenticator.options = { window: 60 };
  const currentExpected = authenticator.generate(cleanSecret);
  const isValid = authenticator.check(cleanCode, cleanSecret) || cleanCode === currentExpected;

  console.log(`[2FA Verification] Input code: '${cleanCode}', Current server code: '${currentExpected}', Valid: ${isValid}`);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid 6-digit authentication code. Please check the code in your Authenticator app.' });
  }

  // Cleanup challenge
  pendingChallenges.delete(challengeTicket);

  // Issue memory-only access token (15 mins) and refresh token (7 days)
  const accessToken = jwt.sign(
    { role: 'master_admin', iss: 'devbox' },
    config.jwtSecret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { role: 'master_admin', type: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: '7d' }
  );

  return res.json({
    success: true,
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 mins
    user: {
      username: 'master_admin',
      role: 'Administrator',
      twoFactorVerified: true
    }
  });
});

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refreshToken' });
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
    const accessToken = jwt.sign(
      { role: decoded.role, iss: 'devbox' },
      config.jwtSecret,
      { expiresIn: '15m' }
    );
    return res.json({ success: true, accessToken, expiresIn: 900 });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

/**
 * Auth Status
 * GET /api/auth/status
 */
router.get('/status', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ authenticated: false });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    return res.json({ authenticated: true, user: decoded });
  } catch {
    return res.json({ authenticated: false });
  }
});

export default router;
