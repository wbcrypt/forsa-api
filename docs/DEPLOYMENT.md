# FORSA OS — Deployment Guide

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| PostgreSQL | 15+ |
| Redis | 7+ |
| S3-compatible storage | AWS S3, Cloudflare R2, or MinIO |

---

## 1. Database Setup

```sql
-- Run as PostgreSQL superuser
CREATE DATABASE forsa_os;

-- Application user (least privilege)
CREATE USER forsa_app       WITH PASSWORD 'CHANGE_ME_STRONG_APP_PASSWORD';
CREATE USER forsa_readonly  WITH PASSWORD 'CHANGE_ME_STRONG_RO_PASSWORD';
CREATE USER forsa_migration WITH PASSWORD 'CHANGE_ME_STRONG_MIG_PASSWORD';

-- Grants
GRANT CONNECT ON DATABASE forsa_os TO forsa_app, forsa_readonly, forsa_migration;

\c forsa_os

GRANT USAGE ON SCHEMA public TO forsa_app, forsa_readonly;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO forsa_migration;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO forsa_migration;

-- After running migrations:
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO forsa_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO forsa_readonly;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO forsa_app;

-- Revoke destructive rights on immutable tables (run after schema migration)
REVOKE UPDATE, DELETE ON audit_logs FROM forsa_app;
REVOKE UPDATE, DELETE ON security_events FROM forsa_app;
REVOKE UPDATE, DELETE ON financial_ledger FROM forsa_app;
REVOKE UPDATE, DELETE ON financing_decisions FROM forsa_app;
REVOKE UPDATE, DELETE ON score_events FROM forsa_app;
```

## 2. Run Database Migration

```bash
# Apply the schema
psql -U forsa_migration -d forsa_os -f migrations/001_initial_schema.sql

# Verify
psql -U forsa_migration -d forsa_os -c "\dt"
```

## 3. Application Setup

```bash
# Clone / upload source
cd /opt/forsa-os

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
nano .env   # Fill in ALL values

# Build TypeScript
npm run build
```

## 4. Generate Encryption Keys

```bash
# PII encryption key (32 bytes = 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# MFA encryption key (different key)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT access secret (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# JWT refresh secret (different 64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 5. Seed Reference Data

```bash
# Seed permissions, document types, referral sources, notification templates
npm run seed

# Create bootstrap admin and first tenant (run ONCE)
npm run seed:admin
```

The seed:admin script will print the **Tenant ID** — save it. Users need it to log in.

After running: **immediately remove BOOTSTRAP_\* variables from .env** and restart.

## 6. Start the Application

```bash
# Development
npm run start:dev

# Production (after build)
npm run start:prod

# With PM2
pm2 start dist/main.js --name forsa-os -i 2
pm2 save
```

## 7. Nginx Reverse Proxy (production)

```nginx
server {
    listen 443 ssl http2;
    server_name os.forsa.tn;

    ssl_certificate     /etc/letsencrypt/live/os.forsa.tn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/os.forsa.tn/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }
}

# HTTP redirect
server {
    listen 80;
    server_name os.forsa.tn;
    return 301 https://$host$request_uri;
}
```

---

## API Endpoints Reference

Base URL: `https://os.forsa.tn/api/v1`

### Authentication
```
POST   /auth/login              # Login (returns tokens or MFA challenge)
POST   /auth/mfa/verify         # Complete MFA and get tokens
POST   /auth/refresh            # Refresh access token
POST   /auth/logout             # Logout current session
GET    /auth/me                 # Get current user info
GET    /auth/mfa/setup          # Get MFA QR code
POST   /auth/mfa/enable         # Enable MFA after verification
```

### Login Flow

```json
// POST /api/v1/auth/login
{
  "email": "admin@forsa.tn",
  "password": "YourPassword123!",
  "tenantId": "uuid-from-seed-admin-output"
}

// Response (no MFA):
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 900,
  "tokenType": "Bearer"
}

// Response (MFA enabled):
{
  "requiresMfa": true,
  "mfaToken": "hex-string",
  "message": "MFA verification required"
}
```

### Core APIs
```
# Students
GET    /students                 # List (paginated, filterable)
POST   /students                 # Create
GET    /students/:id             # Detail (no PII)
GET    /students/:id/pii         # Detail with PII (requires permission)
PATCH  /students/:id             # Update
POST   /students/:id/guarantors  # Add guarantor
DELETE /students/:id/guarantors/:gId  # Withdraw guarantor

# Applications
GET    /applications             # List with filters
POST   /applications             # Create
GET    /applications/:id         # Full detail
PATCH  /applications/:id/status  # Transition status
PATCH  /applications/:id/assign  # Assign to staff
POST   /applications/:id/appeal  # Submit appeal
GET    /applications/:id/pipeline-history

# Pipeline
POST   /pipeline/applications/:id/run   # Start pipeline run
POST   /pipeline/runs/:id/human-decision # Submit reviewer decision

# Payments
POST   /payments/schedules       # Generate schedule
POST   /payments/record          # Record payment
POST   /payments/:id/reverse     # Reverse payment

# Documents
POST   /documents/upload-url     # Get pre-signed upload URL
POST   /documents/:id/confirm-upload
GET    /documents/:id/download-url
PATCH  /documents/:id/review     # Verify or reject
GET    /documents/checklist/applications/:id

# Reports
GET    /reports/ceo
GET    /reports/finance
GET    /reports/sales
GET    /reports/collections
GET    /reports/partners
GET    /reports/audit
```

---

## First Login Checklist

1. Log in with bootstrap email + password + tenantId
2. **Change password immediately** (system enforces this)
3. Set up MFA via `GET /auth/mfa/setup` → `POST /auth/mfa/enable`
4. Create operational staff users with appropriate roles
5. Remove `BOOTSTRAP_*` variables from `.env`
6. Restart application
