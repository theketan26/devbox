import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../services/api.js';
import { setChallenge, loginSuccess, setError, setLoading, resetLoginStep } from '../store/authSlice.js';
import { Lock, Shield, KeyRound, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Zap } from 'lucide-react';

export default function LoginScreen() {
  const dispatch = useDispatch();
  const { loginStep, challengeTicket, qrCode, totpSecret, demoCodeHint, error, loading } = useSelector(
    state => state.auth
  );

  const [password, setPassword] = useState('admin123');
  const [totpCode, setTotpCode] = useState('');

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;

    dispatch(setLoading(true));
    try {
      const res = await api.auth.login(password);
      dispatch(setChallenge(res));
    } catch (err) {
      dispatch(setError(err.message || 'Invalid credentials'));
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    const clean = totpCode.trim();
    if (!clean || clean.length !== 6) return;

    dispatch(setLoading(true));
    try {
      const res = await api.auth.verify2FA(challengeTicket, clean);
      dispatch(loginSuccess(res));
    } catch (err) {
      dispatch(setError(err.message || 'Invalid 6-digit TOTP code'));
    }
  };

  const handleQuickFill = () => {
    if (demoCodeHint) {
      setTotpCode(demoCodeHint);
    }
  };

  return (
    <div className="neo-grid-bg" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div className="neo-card" style={{
        width: '100%',
        maxWidth: '480px',
        padding: '36px',
        boxShadow: 'var(--neo-shadow-xl)'
      }}>
        {/* Decorative Top Sticker */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--neo-yellow)',
          color: '#000000',
          border: 'var(--neo-border-2)',
          boxShadow: 'var(--neo-shadow-sm)',
          padding: '4px 10px',
          fontWeight: 900,
          fontSize: '0.74rem',
          textTransform: 'uppercase',
          marginBottom: '18px',
          transform: 'rotate(-2deg)'
        }}>
          <Zap size={14} strokeWidth={3} />
          <span>Restricted Admin Portal</span>
        </div>

        {/* Brand header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>
            {loginStep === 'credentials' ? 'DEV BOX ACCESS' : '2FA CHALLENGE'}
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--neo-black)', opacity: 0.75, fontWeight: 700 }}>
            {loginStep === 'credentials'
              ? 'Enter master password to initiate 2FA authentication.'
              : 'Scan QR code in Authenticator & enter 6-digit TOTP code.'}
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--neo-red)',
            border: 'var(--neo-border-4)',
            boxShadow: 'var(--neo-shadow-sm)',
            padding: '12px 14px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#000000',
            fontWeight: 900,
            fontSize: '0.86rem'
          }}>
            <AlertCircle size={18} strokeWidth={3} />
            <span>{error}</span>
          </div>
        )}

        {loginStep === 'credentials' ? (
          <form onSubmit={handlePasswordSubmit}>
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
                Master Password
              </label>
              <input
                id="input-master-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password..."
                className="neo-input font-mono"
                autoFocus
              />
              <div style={{ fontSize: '0.76rem', color: 'var(--neo-black)', opacity: 0.75, fontWeight: 700, marginTop: '8px' }}>
                Default demo password: <span className="neo-badge neo-badge-yellow font-mono" style={{ padding: '2px 6px', fontSize: '0.72rem' }}>admin123</span>
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="btn-neo-primary"
              style={{ width: '100%', padding: '13px' }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" strokeWidth={3} />
                  <span>Validating...</span>
                </>
              ) : (
                <>
                  <span>Continue to 2FA</span>
                  <ArrowRight size={16} strokeWidth={3} />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handle2FASubmit}>
            {qrCode && (
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{
                  display: 'inline-block',
                  background: '#FFF',
                  padding: '12px',
                  border: 'var(--neo-border-4)',
                  boxShadow: '6px 6px 0px #000'
                }}>
                  <img src={qrCode} alt="TOTP QR Code" style={{ width: '150px', height: '150px', display: 'block' }} />
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.78rem', fontWeight: 900 }}>
                  SECRET KEY: <code className="font-mono" style={{ background: 'var(--neo-violet)', border: '1px solid #000', padding: '2px 6px' }}>{totpSecret}</code>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 900, textTransform: 'uppercase' }}>
                  6-Digit TOTP Code
                </label>
                {demoCodeHint && (
                  <button
                    type="button"
                    id="btn-quick-fill-otp"
                    onClick={handleQuickFill}
                    className="neo-badge neo-badge-yellow"
                    style={{ cursor: 'pointer', padding: '2px 8px', fontSize: '0.72rem' }}
                  >
                    Quick-Fill ({demoCodeHint})
                  </button>
                )}
              </div>
              <input
                id="input-totp-code"
                type="text"
                maxLength={10}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData('text');
                  const digits = pasted.replace(/\D/g, '').slice(0, 6);
                  setTotpCode(digits);
                }}
                placeholder="000000"
                className="neo-input font-mono"
                style={{
                  fontSize: '1.6rem',
                  letterSpacing: '0.35em',
                  textAlign: 'center',
                  padding: '12px',
                  fontWeight: 900
                }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => dispatch(resetLoginStep())}
                className="btn-neo-outline"
                style={{ flex: 1 }}
              >
                Back
              </button>
              <button
                id="btn-verify-2fa"
                type="submit"
                disabled={loading || totpCode.trim().length !== 6}
                className="btn-neo-primary"
                style={{ flex: 2 }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" strokeWidth={3} />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify & Enter</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
