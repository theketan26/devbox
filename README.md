# Dev Box — Developer Operations, Secrets & Telemetry Hub

Dev Box is a centralized developer operations control plane built according to [plan.md](file:///home/developer/projects/devbox/plan.md). It provides high-security secret management with AES-256-GCM, cross-environment parity auditing, automated health probing with WhatsApp incident alerts, and real-time application telemetry ingestion.

---

## 🛠️ Architecture Overview

- **Frontend**: Single-Page Application on React 19 and Vite with Redux Toolkit and modern dark glassmorphic UI.
- **Backend**: Express.js REST API on Node.js with AES-256-GCM cipher engine, TOTP two-factor authentication, and in-memory JWT tokens.
- **Database Engine**: Dual-mode PostgreSQL/Supabase and local persistent store. Includes Supabase schema migration at `supabase/migrations/001_initial_schema.sql`.
- **WhatsApp Bridge**: Dedicated microservice integration with `whatsapp-web.js` / WAHA via `POST /api/send-message` and `x-api-key` protection.
- **CLI Utility**: Executable CLI (`devbox pull`) for syncing decrypted environment variables locally.

---

## 🚀 Quick Start

### 1. Start Both Backend & Frontend
```bash
npm run dev
```
- **Backend API**: `http://localhost:5000`
- **Frontend Client**: `http://localhost:5173`

### 2. Run Integration Tests
```bash
npm run test
```

### 3. Local CLI Usage
```bash
# Pull production secrets into .env
node cli/bin/devbox.js pull --env production --out .env

# Pull development secrets
node cli/bin/devbox.js pull --env development --out .env.local
```

---

## 🔐 Master Authentication & 2FA
- **Default Master Password**: `admin123`
- **Two-Factor Authentication (TOTP)**: Scannable QR code + one-click developer quick-fill button in UI.
- **Tokens**: In-memory access token (15m expiry) with transparent refresh rotation.

---

## ✨ Implemented Core Features

1. **AES-256-GCM Secret Management**: Encrypts all values with randomized 16-byte IV and GCM authentication tag.
2. **Secret Version History & Rollback**: Immutable audit trail for every variable update with one-click restoration of prior versions.
3. **Cross-Environment Parity Auditor**: Side-by-side comparison matrix across `development`, `staging`, and `production`. Flags missing keys before deployments.
4. **Multi-Format Exports**: One-click generation of `.env`, formatted JSON, Docker Compose environment blocks, and Kubernetes Secret YAML.
5. **Sensitive Clipboard Auto-Clear**: Automatically wipes copied secrets from the OS clipboard after 45 seconds with visual countdown banner.
6. **One-Click .env Bulk Import**: Parses pasted `.env` strings and bulk-encrypts into the targeted project, application, and environment.
7. **Health Probing & Recovery**: Automated endpoint verification with JSON payload assertion, maintenance mode silencing, 60-minute incident throttling, and recovery notifications.
8. **WhatsApp Alert Dispatcher**: Routes incident alerts to WhatsApp via custom microservice bridge (`POST /api/send-message`) with email fallback.
9. **Telemetry Ingestion**: Ingests CPU usage, memory RSS/heap, uptime, and database connection pools via `POST /api/telemetry/ingest` with live UI simulation.
10. **Credential Expiration Tracker**: Tracks SSL certificates, API tokens, and domains with deadline countdowns and status badges.
11. **Resource Links Hub**: Centralized link repository with archive history toggle.
12. **Project Files**: Private file metadata management with 15-minute signed download URLs.
