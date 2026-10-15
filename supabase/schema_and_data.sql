-- =============================================================================
-- DEVBOX SUPABASE POSTGRESQL SCHEMA (PURE DDL - NO SEED DATA)
-- Project: DevBox (https://tocdtmbnghwamhodkbel.supabase.co)
-- =============================================================================

-- 1. Optional Extensions (pg_cron & pg_net)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Extensions notice (pg_cron/pg_net may need Supabase dashboard toggle): %', SQLERRM;
END $$;

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Applications Table
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    repo_url TEXT,
    telemetry_token VARCHAR(64) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Application Deployment URLs Table
CREATE TABLE IF NOT EXISTS application_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    environment VARCHAR(50) NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Configs & Secrets Table
CREATE TABLE IF NOT EXISTS configs_and_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    key VARCHAR(255) NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    is_secret BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Secret Version History Table
CREATE TABLE IF NOT EXISTS config_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES configs_and_secrets(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Credential Expirations Table
CREATE TABLE IF NOT EXISTS credential_expirations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    credential_type VARCHAR(50) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    alert_days_before INT DEFAULT 14,
    notes TEXT,
    is_notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Application Links Table
CREATE TABLE IF NOT EXISTS application_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    notes TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Project Files Metadata Table
CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Application Files Metadata Table
CREATE TABLE IF NOT EXISTS application_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Health Checks Table
CREATE TABLE IF NOT EXISTS health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    endpoint_url TEXT NOT NULL,
    method VARCHAR(10) DEFAULT 'GET',
    interval_minutes INT DEFAULT 5,
    timeout_ms INT DEFAULT 5000,
    expected_status INT DEFAULT 200,
    expected_json_payload JSONB,
    is_maintenance_mode BOOLEAN DEFAULT FALSE,
    current_status VARCHAR(20) DEFAULT 'unknown',
    consecutive_failures INT DEFAULT 0,
    down_since TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ,
    last_status_code INT,
    last_response_time_ms INT,
    last_alerted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Health Check Logs Table
CREATE TABLE IF NOT EXISTS health_check_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    health_check_id UUID NOT NULL REFERENCES health_checks(id) ON DELETE CASCADE,
    status_code INT,
    response_time_ms INT,
    is_success BOOLEAN NOT NULL,
    error_message TEXT,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Application Telemetry Ingestion Table
CREATE TABLE IF NOT EXISTS application_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    memory_rss_mb NUMERIC(8,2),
    memory_heap_mb NUMERIC(8,2),
    uptime_seconds BIGINT,
    db_active_connections INT,
    cpu_usage_pct NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Devbox pg_cron Schedule Registry Table
CREATE TABLE IF NOT EXISTS devbox_pg_crons (
    jobid BIGINT PRIMARY KEY,
    jobname VARCHAR(255) NOT NULL UNIQUE,
    schedule VARCHAR(100) NOT NULL,
    command TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    health_check_id UUID,
    health_check_name VARCHAR(255),
    endpoint_url TEXT,
    interval_minutes INT DEFAULT 5,
    last_status VARCHAR(50),
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PERMISSIONS & ACCESS POLICIES
-- =============================================================================

-- Disable Row Level Security on app tables so the backend has direct read/write access
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE application_deployments DISABLE ROW LEVEL SECURITY;
ALTER TABLE configs_and_secrets DISABLE ROW LEVEL SECURITY;
ALTER TABLE config_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE credential_expirations DISABLE ROW LEVEL SECURITY;
ALTER TABLE application_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE application_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE health_checks DISABLE ROW LEVEL SECURITY;
ALTER TABLE health_check_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE application_telemetry DISABLE ROW LEVEL SECURITY;
ALTER TABLE devbox_pg_crons DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STORAGE BUCKET CONFIGURATION (devbox-files)
-- =============================================================================

-- Ensure private devbox-files storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('devbox-files', 'devbox-files', false)
ON CONFLICT (id) DO NOTHING;

-- Allow storage operations on devbox-files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'devbox_storage_all'
  ) THEN
    CREATE POLICY "devbox_storage_all" ON storage.objects
    FOR ALL
    USING (bucket_id = 'devbox-files')
    WITH CHECK (bucket_id = 'devbox-files');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Notice creating storage policy: %', SQLERRM;
END $$;
