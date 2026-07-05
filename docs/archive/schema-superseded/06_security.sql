-- =============================================================================
-- FORSA OS — Security Infrastructure
-- File: 06_security.sql
-- Must be applied AFTER all table definitions
-- =============================================================================
-- Security controls implemented here:
--   1. PostgreSQL roles with least privilege
--   2. Row Level Security (RLS) for tenant isolation
--   3. Immutable table enforcement (audit_logs, execution_ledger, financial_ledger)
--   4. Encrypted field conventions (documented + enforced via check constraints)
--   5. Signed URL token table for document access
--   6. Rate limiting table for application-layer enforcement
--   7. Security event log (separate from audit_logs)
--   8. API token management
--   9. Encryption key references (keys never stored in DB)
-- =============================================================================


-- =============================================================================
-- SECTION 1: PostgreSQL APPLICATION ROLES (Least Privilege)
-- =============================================================================
-- Three roles are defined:
--   forsa_app       — main application connection (read/write, no delete on protected tables)
--   forsa_readonly  — reporting and investor access
--   forsa_migration — schema migrations only (run by deployment pipeline)
--
-- No application code connects as a superuser.
-- Secrets are injected via environment variables, never hardcoded.
-- =============================================================================

-- Create roles (idempotent-safe via DO block)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'forsa_app') THEN
        CREATE ROLE forsa_app LOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'forsa_readonly') THEN
        CREATE ROLE forsa_readonly LOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'forsa_migration') THEN
        CREATE ROLE forsa_migration LOGIN;
    END IF;
END
$$;

-- =============================================================================
-- SECTION 2: GRANT STRUCTURE — Least Privilege
-- =============================================================================

-- forsa_app: read/write on operational tables, NO DELETE on protected tables
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO forsa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO forsa_app;

-- Revoke UPDATE and DELETE on immutable/append-only tables
-- These tables must ONLY grow, never shrink or change
REVOKE UPDATE, DELETE ON audit_logs FROM forsa_app;
REVOKE UPDATE, DELETE ON execution_ledger FROM forsa_app;
REVOKE UPDATE, DELETE ON financial_ledger FROM forsa_app;
REVOKE UPDATE, DELETE ON score_events FROM forsa_app;
REVOKE UPDATE, DELETE ON pipeline_stage_records FROM forsa_app;
REVOKE UPDATE, DELETE ON reviewer_snapshots FROM forsa_app;
REVOKE UPDATE, DELETE ON contract_signatures FROM forsa_app;
REVOKE UPDATE, DELETE ON application_status_history FROM forsa_app;
REVOKE UPDATE, DELETE ON outbox_events FROM forsa_app;           -- status updates handled by worker role
REVOKE DELETE ON policy_versions FROM forsa_app;                 -- policies are never deleted
REVOKE DELETE ON pipeline_runs FROM forsa_app;                   -- runs are never deleted
REVOKE DELETE ON score_event_supersessions FROM forsa_app;

-- Revoke DELETE broadly — soft deletes only via status fields
REVOKE DELETE ON students FROM forsa_app;
REVOKE DELETE ON users FROM forsa_app;
REVOKE DELETE ON contracts FROM forsa_app;
REVOKE DELETE ON applications FROM forsa_app;
REVOKE DELETE ON guarantors FROM forsa_app;
REVOKE DELETE ON partners FROM forsa_app;
REVOKE DELETE ON universities FROM forsa_app;
REVOKE DELETE ON financing_decisions FROM forsa_app;
REVOKE DELETE ON payment_schedules FROM forsa_app;
REVOKE DELETE ON installments FROM forsa_app;
REVOKE DELETE ON payments FROM forsa_app;
REVOKE DELETE ON university_disbursements FROM forsa_app;
REVOKE DELETE ON partner_commissions FROM forsa_app;

-- forsa_readonly: SELECT only, no writes
GRANT SELECT ON ALL TABLES IN SCHEMA public TO forsa_readonly;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM forsa_readonly;

-- forsa_migration: full DDL (used only by migration pipeline)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO forsa_migration;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO forsa_migration;

-- Separate outbox worker role
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'forsa_outbox_worker') THEN
        CREATE ROLE forsa_outbox_worker LOGIN;
    END IF;
END
$$;
GRANT SELECT, UPDATE ON outbox_events TO forsa_outbox_worker;

COMMENT ON ROLE forsa_app IS
    'Main application role. Cannot delete records or modify immutable tables.
     Password injected at runtime via environment variable — never hardcoded.';

COMMENT ON ROLE forsa_readonly IS
    'Read-only role for reporting, investor dashboards, and audit queries.';


-- =============================================================================
-- SECTION 3: ROW LEVEL SECURITY — Tenant Isolation
-- =============================================================================
-- Every multi-tenant table enforces RLS.
-- The application sets the tenant context at connection time:
--   SET LOCAL app.current_tenant_id = '<uuid>';
-- This is verified by every RLS policy.
-- =============================================================================

-- Helper function to get current tenant from session variable
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID;
$$;

COMMENT ON FUNCTION current_tenant_id() IS
    'Returns the tenant UUID set by the application at session start.
     Returns NULL if not set — causing RLS policies to deny all rows.';

-- Enable RLS and create policies for every tenant-scoped table
DO $$
DECLARE
    t TEXT;
    tenant_tables TEXT[] := ARRAY[
        'tenants', 'tenant_configs', 'users', 'user_sessions', 'user_roles',
        'roles', 'audit_logs', 'data_integrity_events',
        'policy_definitions', 'policy_versions', 'policy_conflicts',
        'universities', 'university_agreements', 'programs', 'program_eligibility',
        'partners', 'partner_agreements', 'partner_commissions',
        'referral_sources', 'campaigns',
        'students', 'student_profiles', 'guarantors', 'student_guarantors',
        'student_exceptional_events',
        'applications', 'application_status_history', 'pipeline_runs',
        'risk_profiles', 'decision_confidence_scores', 'candidate_decisions',
        'capital_queue_entries', 'approval_sets', 'financing_decisions',
        'pipeline_execution_traces', 'application_appeals',
        'execution_requests', 'execution_ledger', 'outbox_events',
        'contracts', 'contract_versions', 'contract_amendments',
        'payment_schedules', 'installments', 'payments',
        'payment_reversals', 'university_disbursements',
        'unrecovered_disbursements', 'financial_ledger',
        'forsa_scores', 'score_dimension_balances', 'score_events',
        'score_event_supersessions', 'score_reconciliation_logs',
        'score_manual_adjustments',
        'documents', 'document_access_logs', 'document_versions',
        'notification_logs'
    ];
BEGIN
    FOREACH t IN ARRAY tenant_tables LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

        -- forsa_app sees only rows belonging to the current tenant
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I
             FOR ALL TO forsa_app
             USING (tenant_id = current_tenant_id())',
            t
        );

        -- forsa_readonly same isolation
        EXECUTE format(
            'CREATE POLICY tenant_isolation_ro ON %I
             FOR SELECT TO forsa_readonly
             USING (tenant_id = current_tenant_id())',
            t
        );
    END LOOP;
END
$$;

COMMENT ON FUNCTION current_tenant_id IS
    'RLS uses this function. If the application fails to set app.current_tenant_id,
     all queries return zero rows — no cross-tenant data leakage is possible.';


-- =============================================================================
-- SECTION 4: IMMUTABLE TABLE ENFORCEMENT — Trigger-Based
-- =============================================================================
-- Defense in depth: even if the application role were compromised,
-- these triggers prevent modification of critical records.
-- =============================================================================

CREATE OR REPLACE FUNCTION enforce_immutable_row()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Immutability violation: table % does not permit UPDATE or DELETE. '
        'Record id=% cannot be modified. '
        'Use the Decision Execution Engine to apply corrections.',
        TG_TABLE_NAME,
        OLD.id;
    RETURN NULL;
END;
$$;

-- Apply immutability trigger to all append-only tables
DO $$
DECLARE
    t TEXT;
    immutable_tables TEXT[] := ARRAY[
        'audit_logs',
        'execution_ledger',
        'financial_ledger',
        'score_events',
        'reviewer_snapshots',
        'contract_signatures',
        'pipeline_execution_traces',
        'application_status_history'
    ];
BEGIN
    FOREACH t IN ARRAY immutable_tables LOOP
        EXECUTE format(
            'CREATE TRIGGER enforce_immutable_%I
             BEFORE UPDATE OR DELETE ON %I
             FOR EACH ROW EXECUTE FUNCTION enforce_immutable_row()',
            t, t
        );
    END LOOP;
END
$$;


-- =============================================================================
-- SECTION 5: SENSITIVE FIELD ENCRYPTION CONVENTIONS
-- =============================================================================
-- Fields containing PII or sensitive data are encrypted at the APPLICATION LAYER
-- before being stored. The database stores ciphertext only.
--
-- Convention:
--   - Encrypted fields are suffixed with _encrypted or _reference (for tokenized values)
--   - The encryption key ID used is stored alongside the field for key rotation support
--   - Raw values (SSN, national ID, etc.) NEVER appear in the database
--
-- Key management: handled by application via environment-injected KMS reference.
-- Keys are NEVER stored in the database.
-- =============================================================================

-- Encryption key version tracking (tracks WHICH key was used, not the key itself)
CREATE TABLE encryption_key_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_alias       VARCHAR(100) NOT NULL,                     -- e.g. 'pii_v1', 'document_v2'
    key_version     INTEGER NOT NULL,
    algorithm       VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
    status          VARCHAR(50) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','rotating','retired')),
    activated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retired_at      TIMESTAMPTZ,

    CONSTRAINT encryption_keys_unique UNIQUE (key_alias, key_version)
);

COMMENT ON TABLE encryption_key_versions IS
    'Tracks which encryption key version was used to encrypt each record.
     The actual key material is NEVER stored in the database.
     Keys are managed externally (KMS, Vault, or environment-injected secrets).';

-- Add key version reference to tables with encrypted fields
ALTER TABLE students
    ADD COLUMN pii_key_version_id UUID REFERENCES encryption_key_versions(id);

ALTER TABLE guarantors
    ADD COLUMN pii_key_version_id UUID REFERENCES encryption_key_versions(id);

ALTER TABLE mfa_configs
    ADD COLUMN key_version_id UUID REFERENCES encryption_key_versions(id);

COMMENT ON COLUMN students.national_id_reference IS
    'Encrypted tokenized reference to national ID. Raw value encrypted at application layer.
     pii_key_version_id identifies which key version was used for rotation support.';

COMMENT ON COLUMN students.pii_key_version_id IS
    'References the encryption key version used for this student''s PII fields.
     Used to identify records requiring re-encryption during key rotation.';


-- =============================================================================
-- SECTION 6: SIGNED DOCUMENT URL TOKENS
-- =============================================================================
-- Documents in S3 are never directly accessible.
-- Access requires a time-limited signed token generated by the application.
-- Every token issuance is logged.
-- =============================================================================

CREATE TABLE document_access_tokens (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    document_id         UUID NOT NULL,                         -- references documents(id)
    token_hash          TEXT NOT NULL UNIQUE,                  -- SHA-256 of the issued token
    issued_to_user_id   UUID NOT NULL REFERENCES users(id),
    issued_for_purpose  VARCHAR(100) NOT NULL
                            CHECK (issued_for_purpose IN (
                                'view','download','verify',
                                'sign','admin_review','audit'
                            )),
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    used_at             TIMESTAMPTZ,
    use_count           INTEGER NOT NULL DEFAULT 0,
    max_uses            INTEGER NOT NULL DEFAULT 1,
    ip_address          INET,
    is_revoked          BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at          TIMESTAMPTZ,
    revoked_by          UUID REFERENCES users(id),
    revocation_reason   TEXT
);

CREATE INDEX idx_doc_tokens_hash ON document_access_tokens(token_hash)
    WHERE is_revoked = FALSE AND expires_at > NOW();

CREATE INDEX idx_doc_tokens_document ON document_access_tokens(document_id);

COMMENT ON TABLE document_access_tokens IS
    'Time-limited, purpose-bound access tokens for S3 document URLs.
     Tokens are hashed before storage — the raw token is never persisted.
     Every document access requires a valid, unexpired, unrevoked token.';


-- =============================================================================
-- SECTION 7: RATE LIMITING SUPPORT TABLE
-- =============================================================================
-- Rate limiting is enforced at the application layer (NestJS guards).
-- This table provides persistent rate limit state for distributed deployments
-- where in-memory rate limiting would be bypassed by multiple instances.
-- =============================================================================

CREATE TABLE rate_limit_buckets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bucket_key      TEXT NOT NULL,                             -- e.g. 'login:ip:192.168.1.1'
    bucket_type     VARCHAR(100) NOT NULL
                        CHECK (bucket_type IN (
                            'login_attempt',
                            'api_request',
                            'document_access',
                            'password_reset',
                            'mfa_attempt',
                            'pipeline_submission'
                        )),
    request_count   INTEGER NOT NULL DEFAULT 1,
    window_start    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    window_end      TIMESTAMPTZ NOT NULL,
    is_blocked      BOOLEAN NOT NULL DEFAULT FALSE,
    blocked_until   TIMESTAMPTZ,
    last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT rate_limit_unique_bucket UNIQUE (bucket_key, bucket_type, window_start)
);

CREATE INDEX idx_rate_limit_active
    ON rate_limit_buckets(bucket_key, bucket_type, window_end)
    WHERE is_blocked = TRUE OR window_end > NOW();

COMMENT ON TABLE rate_limit_buckets IS
    'Persistent rate limit state. Supports distributed NestJS deployments.
     Windows are cleaned up by a scheduled job. Redis can be used as a faster
     alternative for active windows, with this table as the persistent fallback.';


-- =============================================================================
-- SECTION 8: SECURITY EVENT LOG
-- =============================================================================
-- Separate from audit_logs. Captures security-specific events:
-- failed logins, suspicious activity, permission denials, token abuse.
-- This log is the primary feed for intrusion detection.
-- =============================================================================

CREATE TABLE security_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id),               -- NULL for pre-auth events
    user_id         UUID REFERENCES users(id),                 -- NULL for pre-auth events
    session_id      UUID REFERENCES user_sessions(id),
    event_type      VARCHAR(100) NOT NULL
                        CHECK (event_type IN (
                            'login_success',
                            'login_failure',
                            'login_blocked',
                            'mfa_success',
                            'mfa_failure',
                            'mfa_bypass_attempt',
                            'password_reset_requested',
                            'password_reset_completed',
                            'password_changed',
                            'session_invalidated',
                            'permission_denied',
                            'rate_limit_triggered',
                            'suspicious_request',
                            'token_reuse_attempt',
                            'document_token_expired',
                            'document_token_revoked',
                            'immutability_violation_attempt',
                            'rls_violation_attempt',
                            'api_key_invalid',
                            'account_locked',
                            'account_unlocked',
                            'role_elevated',
                            'role_revoked',
                            'admin_action'
                        )),
    severity        VARCHAR(50) NOT NULL
                        CHECK (severity IN ('info','warning','high','critical')),
    ip_address      INET,
    user_agent      TEXT,
    device_fingerprint TEXT,
    endpoint        TEXT,                                      -- API endpoint attempted
    details         JSONB,                                     -- structured event context
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()

    -- Append-only: no UPDATE or DELETE
);

CREATE INDEX idx_security_events_tenant ON security_events(tenant_id, created_at DESC);
CREATE INDEX idx_security_events_user ON security_events(user_id, created_at DESC);
CREATE INDEX idx_security_events_type ON security_events(event_type, severity);
CREATE INDEX idx_security_events_ip ON security_events(ip_address, created_at DESC);
CREATE INDEX idx_security_events_critical
    ON security_events(tenant_id, created_at DESC)
    WHERE severity IN ('high','critical');

COMMENT ON TABLE security_events IS
    'Security-specific event log. Separate from business audit_logs.
     Primary feed for intrusion detection and security monitoring.
     Append-only. No UPDATE or DELETE.';

-- Immutability trigger for security events
CREATE TRIGGER enforce_immutable_security_events
    BEFORE UPDATE OR DELETE ON security_events
    FOR EACH ROW EXECUTE FUNCTION enforce_immutable_row();


-- =============================================================================
-- SECTION 9: API TOKEN MANAGEMENT
-- =============================================================================
-- For future API clients, partner integrations, and webhook consumers.
-- Raw tokens are NEVER stored — only their hashes.
-- =============================================================================

CREATE TABLE api_tokens (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    name                VARCHAR(255) NOT NULL,
    token_hash          TEXT NOT NULL UNIQUE,                  -- SHA-256 of raw token
    token_prefix        VARCHAR(20) NOT NULL,                  -- first 8 chars for identification
    scopes              TEXT[] NOT NULL,                       -- granted permission scopes
    issued_to_user_id   UUID REFERENCES users(id),            -- NULL for service accounts
    issued_to_service   VARCHAR(100),                          -- service account name
    expires_at          TIMESTAMPTZ,                           -- NULL = non-expiring (discouraged)
    last_used_at        TIMESTAMPTZ,
    use_count           BIGINT NOT NULL DEFAULT 0,
    ip_allowlist        INET[],                                -- NULL = any IP allowed
    is_revoked          BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at          TIMESTAMPTZ,
    revoked_by          UUID REFERENCES users(id),
    revocation_reason   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_api_tokens_hash ON api_tokens(token_hash)
    WHERE is_revoked = FALSE;

COMMENT ON TABLE api_tokens IS
    'API token registry. Raw tokens are never stored — SHA-256 hash only.
     Token prefix stored for identification in logs without exposing the secret.
     Tokens are scoped to specific permissions and optionally IP-restricted.';


-- =============================================================================
-- SECTION 10: INPUT VALIDATION CONSTRAINTS
-- =============================================================================
-- Defense-in-depth: database-level constraints catch malformed data
-- that bypasses application-layer validation (OWASP A03: Injection prevention).
-- =============================================================================

-- Email format validation
ALTER TABLE users
    ADD CONSTRAINT users_email_format
    CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$');

ALTER TABLE students
    ADD CONSTRAINT students_email_format
    CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$');

-- Currency code format (ISO 4217)
ALTER TABLE payment_schedules
    ADD CONSTRAINT payment_schedules_currency_format
    CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE installments
    ADD CONSTRAINT installments_currency_format
    CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE payments
    ADD CONSTRAINT payments_currency_format
    CHECK (currency ~ '^[A-Z]{3}$');

-- Positive monetary amounts
ALTER TABLE installments
    ADD CONSTRAINT installments_positive_amount CHECK (amount > 0);

ALTER TABLE payments
    ADD CONSTRAINT payments_positive_amount CHECK (amount > 0);

ALTER TABLE university_disbursements
    ADD CONSTRAINT disbursements_positive_amount CHECK (amount > 0);

-- Score range enforcement
ALTER TABLE forsa_scores
    ADD CONSTRAINT forsa_score_range
    CHECK (aggregate_score >= 300 AND aggregate_score <= 1000);

-- No future timestamps on immutable event records
ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_no_future_timestamp
    CHECK (created_at <= NOW() + INTERVAL '5 seconds');

ALTER TABLE score_events
    ADD CONSTRAINT score_events_no_future_timestamp
    CHECK (created_at <= NOW() + INTERVAL '5 seconds');


-- =============================================================================
-- SECTION 11: SECURITY DOCUMENTATION COMMENTS
-- =============================================================================

COMMENT ON TABLE users IS
    'Internal FORSA users.
     SECURITY: passwords stored as bcrypt/argon2 hashes ONLY.
     Plain text passwords must NEVER appear in this table or any log.
     MFA secrets stored encrypted in mfa_configs.
     national_id_reference fields use application-layer encryption.';

COMMENT ON TABLE user_sessions IS
    'Session tracking.
     SECURITY: only session token HASH stored, never the raw token.
     Sessions are invalidated (not deleted) on logout.
     Suspicious sessions trigger security_events records.';

COMMENT ON TABLE documents IS
    'Document metadata only. No binary content in the database.
     SECURITY: actual files stored in S3-compatible storage with server-side encryption.
     Access requires a signed URL generated from document_access_tokens.
     Every access is logged in document_access_logs.';

COMMENT ON TABLE financial_ledger IS
    'Double-entry financial ledger.
     SECURITY: append-only enforced via role grants and immutability trigger.
     All entries reference an execution_ledger record proving they were authorized.
     No entry exists without a traceable authorization chain.';
