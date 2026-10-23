import store from '../store/index.js';
import { updateAccessToken, logout } from '../store/authSlice.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function apiRequest(endpoint, options = {}) {
  const state = store.getState();
  const token = state.auth.accessToken;

  const headers = {
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  // Handle automatic token refresh if token expired
  if (response.status === 401 && state.auth.refreshToken) {
    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: state.auth.refreshToken })
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        store.dispatch(updateAccessToken({ accessToken: refreshData.accessToken }));

        // Retry original request with fresh token
        headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
        response = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers
        });
      } else {
        store.dispatch(logout());
      }
    } catch {
      store.dispatch(logout());
    }
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP error ${response.status}`);
    }
    return data;
  }

  const textData = await response.text();
  if (!response.ok) {
    throw new Error(textData || `HTTP error ${response.status}`);
  }
  return textData;
}

export const api = {
  auth: {
    login: (password) => apiRequest('/auth/login', { method: 'POST', body: { password } }),
    verify2FA: (challengeTicket, totpCode) =>
      apiRequest('/auth/verify-2fa', { method: 'POST', body: { challengeTicket, totpCode } }),
    refresh: (refreshToken) =>
      apiRequest('/auth/refresh', { method: 'POST', body: { refreshToken } }),
    status: () => apiRequest('/auth/status')
  },
  dashboard: {
    getStats: () => apiRequest('/dashboard/stats')
  },
  projects: {
    list: () => apiRequest('/projects'),
    get: (id) => apiRequest(`/projects/${id}`),
    create: (data) => apiRequest('/projects', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/projects/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/projects/${id}`, { method: 'DELETE' }),
    uploadFile: (id, formData) => apiRequest(`/projects/${id}/files`, { method: 'POST', body: formData }),
    getDownloadUrl: (id, fileId) => apiRequest(`/projects/${id}/files/${fileId}/download`),
    deleteFile: (id, fileId) => apiRequest(`/projects/${id}/files/${fileId}`, { method: 'DELETE' }),
    getSupabaseStatus: () => apiRequest('/projects/supabase-status')
  },
  applications: {
    list: (projectId) => apiRequest(`/applications${projectId ? `?projectId=${projectId}` : ''}`),
    get: (id) => apiRequest(`/applications/${id}`),
    create: (data) => apiRequest('/applications', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/applications/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/applications/${id}`, { method: 'DELETE' }),
    addDeployment: (id, data) => apiRequest(`/applications/${id}/deployments`, { method: 'POST', body: data }),
    deleteDeployment: (id, depId) => apiRequest(`/applications/${id}/deployments/${depId}`, { method: 'DELETE' }),
    listFiles: (id) => apiRequest(`/applications/${id}/files`),
    uploadFile: (id, data) => apiRequest(`/applications/${id}/files`, { method: 'POST', body: data }),
    getDownloadUrl: (id, fileId) => apiRequest(`/applications/${id}/files/${fileId}/download`),
    deleteFile: (id, fileId) => apiRequest(`/applications/${id}/files/${fileId}`, { method: 'DELETE' })
  },
  configs: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/configs${q ? `?${q}` : ''}`);
    },
    create: (data) => apiRequest('/configs', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/configs/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/configs/${id}`, { method: 'DELETE' }),
    getParity: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/configs/parity${q ? `?${q}` : ''}`);
    },
    export: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/configs/export${q ? `?${q}` : ''}`);
    },
    rollback: (id, versionNumber) =>
      apiRequest(`/configs/${id}/rollback`, { method: 'POST', body: { versionNumber } }),
    import: (data) => apiRequest('/configs/import', { method: 'POST', body: data })
  },
  links: {
    list: (arg1, arg2) => {
      if (typeof arg1 === 'object') {
        const q = new URLSearchParams(arg1).toString();
        return apiRequest(`/links${q ? `?${q}` : ''}`);
      }
      const q = new URLSearchParams({
        ...(arg1 ? { applicationId: arg1 } : {}),
        includeArchived: arg2 !== undefined ? String(arg2) : 'true'
      }).toString();
      return apiRequest(`/links${q ? `?${q}` : ''}`);
    },
    create: (data) => apiRequest('/links', { method: 'POST', body: data }),
    toggleArchive: (id) => apiRequest(`/links/${id}/archive`, { method: 'PATCH' }),
    delete: (id) => apiRequest(`/links/${id}`, { method: 'DELETE' })
  },
  healthChecks: {
    list: (applicationId) =>
      apiRequest(`/health-checks${applicationId ? `?applicationId=${applicationId}` : ''}`),
    get: (id) => apiRequest(`/health-checks/${id}`),
    create: (data) => apiRequest('/health-checks', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/health-checks/${id}`, { method: 'PUT', body: data }),
    ping: (id) => apiRequest(`/health-checks/${id}/ping`, { method: 'POST' }),
    delete: (id) => apiRequest(`/health-checks/${id}`, { method: 'DELETE' }),
    updateCron: (id, cronSchedule, intervalMinutes) =>
      apiRequest(`/health-checks/${id}/cron`, {
        method: 'PUT',
        body: { cron_schedule: cronSchedule, interval_minutes: intervalMinutes }
      }),
    getCronPresets: () => apiRequest('/health-checks/cron/presets'),
    listPgCrons: () => apiRequest('/health-checks/pg-cron'),
    syncPgCrons: () => apiRequest('/health-checks/pg-cron/sync', { method: 'POST' })
  },
  telemetry: {
    getHistory: (applicationId) => apiRequest(`/telemetry/${applicationId}`),
    simulate: (applicationId) =>
      apiRequest(`/telemetry/${applicationId}/simulate`, { method: 'POST' })
  },
  whatsapp: {
    getStatus: () => apiRequest('/whatsapp/status'),
    sendTest: (message, recipient) =>
      apiRequest('/whatsapp/test', { method: 'POST', body: { message, recipient } })
  }
};
