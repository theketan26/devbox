import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';

class Database {
  constructor() {
    this.data = {
      projects: [],
      applications: [],
      application_deployments: [],
      configs_and_secrets: [],
      config_versions: [],
      credential_expirations: [],
      application_links: [],
      project_files: [],
      health_checks: [],
      health_check_logs: [],
      application_telemetry: [],
      application_files: [],
      pg_crons: []
    };
  }

  load() {
    // Supabase PostgreSQL is the persistent database source of truth
  }

  save() {
    // Supabase PostgreSQL is the persistent database source of truth
  }
}

export const db = new Database();
