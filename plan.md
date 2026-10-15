Here is the updated, comprehensive implementation plan for **Dev Box**, incorporating your architectural decisions, the new active features, the dedicated `whatsapp-web.js` integration requirements, and the revised future scope backlog.

### 1. System Architecture Blueprint

* **Frontend layer (React + Shadcn/ui + Redux Toolkit)**: Single-page application built on Vite and React. Handles memory-only access tokens, 2FA validation, environment parity auditing, multi-format config exports, and sensitive clipboard auto-clearing.
* **API layer (Express.js on Vercel)**: Modular REST API managing master authentication, AES-256-GCM secret encryption, version history tracking, file streaming with Supabase, and telemetry ingestion.
* **Database & Scheduler (Supabase PostgreSQL + pg_cron)**: PostgreSQL manages all relational data. Instead of relying on Vercel Cron, Supabase's native `pg_cron` and `pg_net` extensions execute scheduled checks directly on exact 1-to-5-minute intervals inside the database without serverless limits or cold starts.
* **Storage (Supabase Storage)**: Dedicated private bucket (`devbox-files`) storing project auxiliary files and documents, accessed via short-lived signed URLs.
* **Alert dispatchers**: Email alerts dispatched via Resend/Nodemailer; WhatsApp alerts routed directly to your custom `whatsapp-web.js` microservice.

### 2. Requirements for Your `whatsapp-web.js` Server

To integrate smoothly with Dev Box's notification router, your custom `whatsapp-web.js` server requires the following capabilities:

* **Send message endpoint (`POST /api/send-message`)**:
* Request payload: JSON object containing `{ "recipient": "91XXXXXXXXXX@c.us", "message": "string" }`.
* Response format: Standard JSON confirming dispatch `{ "success": true, "messageId": "string", "timestamp": "ISO_STRING" }`.


* **API key protection (`x-api-key` header)**: Protects the endpoint from unauthorized public calls using a shared secret matching `WHATSAPP_SERVER_SECRET` in Dev Box's `.env`.
* **Health & connection status endpoint (`GET /api/status`)**:
* Returns client connection states (`CONNECTED`, `QR_REQUIRED`, `DISCONNECTED`, `LOGGED_OUT`).
* Enables Dev Box to check whether the WhatsApp client is online before attempting alert delivery.


* **Persistent session storage (`LocalAuth`)**: Uses `whatsapp-web.js`'s built-in `LocalAuth` strategy with persistent volume storage to avoid losing session credentials across server restarts.
* **Auto-reconnect handler**: Automatically re-initializes client listeners on network dropouts and logs disconnection events.

### 3. Database Schema (Supabase PostgreSQL)

```sql
-- Enable cron and network extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Applications
CREATE TABLE applications (
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
CREATE TABLE application_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    environment VARCHAR(50) NOT NULL, -- 'production', 'staging', 'preview'
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Environment Variables & Secrets
CREATE TABLE configs_and_secrets (
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
CREATE TABLE config_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES configs_and_secrets(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Credential & Expiration Tracker
CREATE TABLE credential_expirations (
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
CREATE TABLE application_links (
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
CREATE TABLE project_files (
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
CREATE TABLE health_checks (
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
CREATE TABLE health_check_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    health_check_id UUID NOT NULL REFERENCES health_checks(id) ON DELETE CASCADE,
    status_code INT,
    response_time_ms INT,
    is_success BOOLEAN NOT NULL,
    error_message TEXT,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Application Telemetry Ingestion
CREATE TABLE application_telemetry (
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
SELECT cron.schedule(
    'devbox-health-check-cron',
    '*/5 * * * *',
    $$
    SELECT net.http_get(
        url := 'https://your-devbox-app.vercel.app/api/cron/health-check',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
        )
    );
    $$
);

```

### 4. Core Features Specification

#### Config & Secret Management System

* **Multi-format configuration export**: Exports configurations as standard `.env`, formatted JSON, Docker Compose environment blocks, and Kubernetes Secret YAML.
* **Cross-environment parity checker**: Compares keys across `development`, `staging`, and `production` environments side-by-side, flagging missing or orphaned variables before deployments.
* **Sensitive clipboard auto-clear**: Automatically wipes copied secrets from the operating system clipboard after 45 seconds using a custom React clipboard hook.
* **One-click .env bulk import**: Ingests pasted `.env` strings, parses key-value pairs, and encrypts values into the active project or application.
* **Secret versioning and rollback**: Keeps an immutable log of prior secret values, with a one-click rollback action that restores previous versions.
* **Expiration tracker**: Records expiration dates for domains, SSL certificates, and SaaS tokens, displaying warning badges and generating alerts ahead of deadlines.
* **Local CLI utility (`devbox pull`)**: Fetches decrypted environment variables directly into local project `.env` files via a terminal command authenticated with `DEVBOX_CLI_MASTER_KEY`.

#### Health Checker & Incident System

* **Supabase pg_cron execution**: Pings monitored endpoints on schedule directly from PostgreSQL, removing dependency on external serverless cron schedulers.
* **Maintenance mode switch**: Pauses health checks and silences alerts with a single toggle during maintenance or deployments.
* **Response payload validation**: Checks HTTP status codes and validates response bodies against expected JSON structures (such as `{"status": "ok"}`).
* **Automated recovery notifications**: Dispatches recovery notifications via email and WhatsApp with total outage duration as soon as a failing endpoint recovers.
* **Incident throttling**: Enforces a 60-minute alert cooldown after triggering on 2 consecutive failures to prevent notification spam.

#### Application Telemetry Ingestion

* **Ingestion endpoint (`POST /api/telemetry/ingest`)**: Receives JSON telemetry payloads from your applications authenticated via an application-specific `telemetry_token`.
* **Resource dashboards**: Visualizes CPU load, memory footprints (RSS and heap), process uptime, and database connection pool levels using Shadcn/ui charts.

### 5. API Route Structure

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/auth/login` | POST | Verifies master credentials and returns a 2FA challenge ticket |
| `/api/auth/verify-2fa` | POST | Validates 6-digit TOTP code and returns access and refresh tokens |
| `/api/auth/refresh` | POST | Exchanges refresh token for a new in-memory access token |
| `/api/projects` | GET, POST | Lists and creates projects |
| `/api/projects/:id/files` | GET, POST | Manages attachments and provides signed download URLs |
| `/api/applications/:id` | GET, PUT, DELETE | Fetches application hierarchy, deployments, and resource links |
| `/api/configs` | GET, POST, PUT | Manages secrets, parses imports, and writes version histories |
| `/api/configs/parity` | GET | Returns key comparison matrix across environments |
| `/api/configs/export` | GET | Returns exported configs in dotenv, JSON, Docker, or K8s formats |
| `/api/configs/:id/rollback` | POST | Reverts an environment secret to a specified prior version |
| `/api/cli/pull` | GET | Returns decrypted secrets to the local CLI |
| `/api/expirations` | GET, POST, DELETE | Manages expirations for credentials, domains, and certificates |
| `/api/links/:id/archive` | PATCH | Toggles archived status for an application resource link |
| `/api/health-checks` | GET, POST, PUT | Manages monitored endpoints, maintenance mode, and payload rules |
| `/api/cron/health-check` | GET | Probing endpoint invoked by Supabase `pg_cron` via `pg_net` |
| `/api/telemetry/ingest` | POST | Ingests resource metrics from deployed applications |

### 6. Implementation Roadmap

* **Phase 1: Database & Supabase setup**
* Run the PostgreSQL migration schema and enable `pg_cron` and `pg_net` extensions.
* Schedule the health check cron job inside Supabase.
* Set up the private `devbox-files` storage bucket.


* **Phase 2: Express backend core & security**
* Set up Express on Vercel Serverless with master login and `otplib` TOTP validation.
* Implement AES-256-GCM encryption helpers and secret version history logging.
* Build the `.env` import parser and multi-format config exporter (dotenv, JSON, Docker, K8s).
* Build the cross-environment parity comparison query endpoint.
* Implement the `devbox-cli` pull script.


* **Phase 3: Health check engine, telemetry & WhatsApp bridge**
* Build the endpoint runner with maintenance mode checks and JSON payload assertion.
* Connect the alert router to your custom `whatsapp-web.js` server (`POST /api/send-message`) with fallback to email via Resend.
* Implement the downtime calculator and recovery notification trigger.
* Build the telemetry ingestion endpoint.


* **Phase 4: Frontend development (React + Shadcn/ui + Redux)**
* Build the master login screen with two-step TOTP challenge.
* Build the environment parity matrix view and multi-format export modal.
* Implement the clipboard auto-clear timer hook.
* Construct application dashboards with secret version history drawers and resource link tables.
* Build the Health Checker dashboard with maintenance toggles and telemetry metric charts.


* **Phase 5: Verification & deployment**
* Configure environment variables on Vercel and your `whatsapp-web.js` host.
* Verify token refresh behavior, test CLI secret exports, and simulate service downtime to validate WhatsApp alert and recovery notifications.



### 7. Future Scope & Backlog (Post-Launch)

* **Master login brute-force rate limiting**: IP-based lockout middleware (`express-rate-limit`) preventing credential-stuffing attacks.
* **Zero-config backup alert channels**: Telegram Bot and Discord Webhook dispatchers as free secondary notification pipelines.
* **Rolling telemetry data retention policy**: Automated scheduled cleanup job pruning raw telemetry records older than 7 days.
* **Public status badge APIs**: Suite of unauthenticated SVG badge endpoints (e.g., uptime percentage, build status, current health) to embed into GitHub README files.
* **Command palette (Cmd/Ctrl + K)**: Global keyboard-driven search indexing projects, applications, secrets, links, and documents.
* **SaaS and infrastructure subscription ledger**: Recurring infrastructure cost tracker calculating monthly expenses per application and project.
* **Quick cURL generator**: One-click generation of authenticated cURL test commands with decrypted secrets pre-filled.
* **Database backup and retention logger**: Provider log tracking backup dates and retention windows across database instances.
* **Encrypted database export**: Single-click offline snapshot download containing all encrypted Dev Box records.