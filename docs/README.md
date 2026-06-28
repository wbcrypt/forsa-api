# FORSA OS

**Educational Financing ERP/CRM Platform**  
Version 1.0 — Internal Operations System

---

## What This Is

FORSA OS is a multi-tenant ERP/CRM for managing educational financing operations. FORSA acts as a reseller/intermediary — no cash to students. The system manages the full lifecycle from lead to repayment.

**Stack:** NestJS · PostgreSQL · Redis · S3 · TypeScript

---

## Architecture

### Four-Engine Core
1. **FORSA Score Engine** — student trust score (300–1000), 5 dimensions, immutable event log, mandatory reconciliation
2. **Risk Profile Engine** — per-application risk assessment, policy-driven weights
3. **Decision Confidence Score** — reliability rating on each financing recommendation
4. **Financing Decision Pipeline** — 10 mandatory stages, every run immutable

### 10-Stage Pipeline
```
1. Completeness Gate
2. Eligibility Gate
3. University & Partnership Gate
4. Risk Assessment
5. Policy Evaluation
6. Portfolio & Capital Evaluation
7. Approval Threshold Evaluation
8. Human Decision (if required)
9. Decision Generation
10. Decision Execution
```

### Financing Levels
- **Level 1** — Full FORSA financing, low risk
- **Level 2** — Full FORSA financing, medium risk
- **Level 3** — Referral model: university discount, FORSA commission, no capital deployed

### Security
- Argon2id password hashing
- AES-256-GCM application-layer PII encryption
- JWT (15 min) + refresh tokens (7 days) + session management
- TOTP MFA
- RBAC with 60+ fine-grained permissions
- Append-only audit logs, financial ledger, score events
- Pre-signed S3 URLs (documents never served through app)
- PostgreSQL RLS for tenant isolation

---

## Quick Start

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your values

# 2. Create database and run schema
psql -U postgres -c "CREATE DATABASE forsa_os;"
psql -U forsa_migration -d forsa_os -f migrations/001_initial_schema.sql

# 3. Install dependencies
npm install

# 4. Seed reference data + bootstrap admin
npm run seed
npm run seed:admin
# Note the Tenant ID printed at the end

# 5. Start in development
npm run start:dev

# 6. Access API docs
open http://localhost:3000/api/v1/docs
```

---

## Module Structure

```
src/
├── auth/           # JWT, MFA, sessions, security events
├── users/          # User management, roles, permissions
├── policy/         # Policy Engine — versioned, precedence-based
├── universities/   # University lifecycle, agreements, programs
├── partners/       # Partner management, commissions (Level 3)
├── students/       # Student lifecycle, guarantors, PII
├── applications/   # Application state machine
├── pipeline/       # 10-stage Financing Decision Pipeline
├── score/          # FORSA Score Engine
├── documents/      # S3 document management
├── contracts/      # Contract generation and signatures
├── payments/       # Schedules, installments, recording, ledger
├── collections/    # Overdue tracking, prioritized worklist
├── execution/      # Decision Execution Engine (idempotent, ACID)
├── notifications/  # Email, SMS, in-app (outbox pattern)
├── reports/        # CEO, Finance, Sales, Collections, Partner dashboards
└── common/         # Shared: decorators, filters, interceptors, utils
```

---

## Key Design Rules
- **No hardcoded commercial values** — fees, percentages, thresholds all via Policy Engine
- **All PII encrypted** at application layer before reaching DB
- **Immutable records** — audit logs, financial ledger, score events, financing decisions never updated or deleted
- **Double-entry accounting** — every payment creates debit + credit ledger entries
- **Idempotent execution** — DEE prevents duplicate side effects via execution_id
- **Tenant isolation** — PostgreSQL RLS enforced on every request

See `docs/DEPLOYMENT.md` for full setup instructions.  
See `docs/SECURITY_CHECKLIST.md` before going live.
