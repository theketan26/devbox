-- Dev Box Database Schema (Supabase PostgreSQL)
-- Enable cron and network extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Applications
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    repo_url TEXT,
    telemetry_token VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Application Deployed URLs
CREATE TABLE IF NOT EXISTS application_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    environment VARCHAR(50) NOT NULL, -- 'production', 'staging', 'preview'
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Environment Variables & Secrets
CREATE TABLE IF NOT EXISTS configs_and_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE, -- NULL if project shared
    environment VARCHAR(50) NOT NULL DEFAULT 'production', -- 'development', 'staging', 'production'
    key VARCHAR(255) NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    is_secret BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Secret Version History
CREATE TABLE IF NOT EXISTS config_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES configs_and_secrets(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Credential & Expiration Tracker
CREATE TABLE IF NOT EXISTS credential_expirations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    credential_type VARCHAR(50) NOT NULL, -- 'api_token', 'ssl_cert', 'domain', 'saas_key'
    expires_at TIMESTAMPTZ NOT NULL,
    alert_days_before INT DEFAULT 14,
    notes TEXT,
    is_notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Application Resource Links (with archive history)
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

-- 8. Project Files Metadata
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

-- 9. Health Checks
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

-- 10. Health Check Execution Logs
CREATE TABLE IF NOT EXISTS health_check_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    health_check_id UUID NOT NULL REFERENCES health_checks(id) ON DELETE CASCADE,
    status_code INT,
    response_time_ms INT,
    is_success BOOLEAN NOT NULL,
    error_message TEXT,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Application Telemetry Ingestion
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

-- 12. Supabase Native pg_cron Registration
-- Calls Express backend check runner via pg_net every 5 minutes
-- SELECT cron.schedule(
--     'devbox-health-check-cron',
--     '*/5 * * * *',
--     $$
--     SELECT net.http_get(
--         url := 'https://your-devbox-app.vercel.app/api/cron/health-check',
--         headers := jsonb_build_object(
--             'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
--         )
--     );
--     $$
-- );
