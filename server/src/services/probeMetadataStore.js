import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const METADATA_FILE = path.join(DATA_DIR, 'probe_metadata.json');

let inMemoryStore = {};
let isLoaded = false;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore() {
  if (isLoaded) return inMemoryStore;
  try {
    ensureDataDir();
    if (fs.existsSync(METADATA_FILE)) {
      const raw = fs.readFileSync(METADATA_FILE, 'utf8');
      inMemoryStore = JSON.parse(raw);
    } else {
      inMemoryStore = {};
    }
  } catch (err) {
    console.warn('[ProbeMetadataStore] Notice loading metadata file:', err.message);
    inMemoryStore = {};
  }
  isLoaded = true;
  return inMemoryStore;
}

function persistStore() {
  try {
    ensureDataDir();
    fs.writeFileSync(METADATA_FILE, JSON.stringify(inMemoryStore, null, 2), 'utf8');
  } catch (err) {
    console.error('[ProbeMetadataStore] Error writing metadata file:', err.message);
  }
}

/**
 * Normalize headers input into a clean key-value object
 * @param {object|string|null} headers
 * @returns {object|null}
 */
export function normalizeHeaders(headers) {
  if (!headers) return null;
  if (typeof headers === 'string') {
    const trimmed = headers.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
      // Parse Line-separated "Header: Value" syntax
      const obj = {};
      const lines = trimmed.split('\n');
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          const val = line.slice(colonIdx + 1).trim();
          if (key) obj[key] = val;
        }
      }
      return Object.keys(obj).length > 0 ? obj : null;
    }
  }
  if (typeof headers === 'object' && headers !== null) {
    return Object.keys(headers).length > 0 ? headers : null;
  }
  return null;
}

/**
 * Normalize request body
 * @param {any} body
 * @returns {any}
 */
export function normalizeRequestBody(body) {
  if (body === undefined || body === null) return null;
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return body;
}

export function getProbeMetadata(probeId) {
  loadStore();
  return inMemoryStore[probeId] || { headers: null, request_body: null, cron_schedule: null };
}

export function getAllProbeMetadata() {
  return loadStore();
}

export function setProbeMetadata(probeId, updates = {}) {
  loadStore();
  const existing = inMemoryStore[probeId] || {};

  let headers = existing.headers !== undefined ? existing.headers : null;
  if (updates.headers !== undefined) {
    headers = normalizeHeaders(updates.headers);
  }

  let request_body = existing.request_body !== undefined ? existing.request_body : null;
  const rawBody = updates.request_body !== undefined ? updates.request_body : updates.requestBody;
  if (rawBody !== undefined) {
    request_body = normalizeRequestBody(rawBody);
  }

  let cron_schedule = existing.cron_schedule !== undefined ? existing.cron_schedule : null;
  if (updates.cron_schedule !== undefined && updates.cron_schedule !== null) {
    cron_schedule = updates.cron_schedule;
  }

  inMemoryStore[probeId] = {
    ...existing,
    headers,
    request_body,
    cron_schedule,
    updated_at: new Date().toISOString()
  };

  persistStore();
  return inMemoryStore[probeId];
}

export function deleteProbeMetadata(probeId) {
  loadStore();
  if (inMemoryStore[probeId]) {
    delete inMemoryStore[probeId];
    persistStore();
  }
}
