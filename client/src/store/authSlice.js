import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  accessToken: null,
  refreshToken: sessionStorage.getItem('devbox_refresh_token') || null,
  isAuthenticated: false,
  user: null,
  loginStep: 'credentials', // 'credentials' | '2fa' | 'authenticated'
  challengeTicket: null,
  totpSecret: null,
  qrCode: null,
  demoCodeHint: null,
  error: null,
  loading: false
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setChallenge: (state, action) => {
      state.loginStep = '2fa';
      state.challengeTicket = action.payload.challengeTicket;
      state.totpSecret = action.payload.totpSecret;
      state.qrCode = action.payload.qrCode;
      state.demoCodeHint = action.payload.demoCodeHint;
      state.error = null;
      state.loading = false;
    },
    loginSuccess: (state, action) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.loginStep = 'authenticated';
      state.challengeTicket = null;
      state.error = null;
      state.loading = false;
      if (action.payload.refreshToken) {
        sessionStorage.setItem('devbox_refresh_token', action.payload.refreshToken);
      }
    },
    updateAccessToken: (state, action) => {
      state.accessToken = action.payload.accessToken;
    },
    logout: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.user = null;
      state.loginStep = 'credentials';
      state.challengeTicket = null;
      sessionStorage.removeItem('devbox_refresh_token');
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    resetLoginStep: (state) => {
      state.loginStep = 'credentials';
      state.challengeTicket = null;
      state.error = null;
      state.loading = false;
    }
  }
});

export const {
  setChallenge,
  loginSuccess,
  updateAccessToken,
  logout,
  setError,
  setLoading,
  resetLoginStep
} = authSlice.actions;

export default authSlice.reducer;
