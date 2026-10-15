import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../services/api.js';
import { setChallenge, loginSuccess, setError, setLoading, resetLoginStep } from '../store/authSlice.js';
import { ArrowRight, AlertCircle, RefreshCw, Zap } from 'lucide-react';

export default function LoginScreen() {
  const dispatch = useDispatch();
  const { loginStep, challengeTicket, error, loading } = useSelector(
    state => state.auth
  );

  const [password, setPassword] = useState('');
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
        maxWidth: '460px',
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
            {loginStep === 'credentials' ? 'DEV BOX ACCESS' : '2FA VERIFICATION'}
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--neo-black)', opacity: 0.75, fontWeight: 700 }}>
            {loginStep === 'credentials'
              ? 'Enter master password to initiate authentication.'
              : 'Enter the 6-digit code currently shown in your Authenticator app.'}
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
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading || !password}
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
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
                6-Digit Authenticator Code
              </label>
              <input
                id="input-totp-code"
                type="text"
                maxLength={6}
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
                  fontSize: '1.8rem',
                  letterSpacing: '0.35em',
                  textAlign: 'center',
                  padding: '14px',
                  fontWeight: 900
                }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setTotpCode('');
                  dispatch(resetLoginStep());
                }}
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
