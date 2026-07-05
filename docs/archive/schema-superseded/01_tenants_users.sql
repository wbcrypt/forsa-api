-- =============================================================================
-- FORSA OS — PostgreSQL Database Schema
-- Domain 1: Tenants & Organization
-- Domain 2: Users, Roles & Permissions
-- =============================================================================
-- Architecture: Multi-tenant, append-only audit, RBAC
-- All timestamps stored as TIMESTAMPTZ (UTC)
-- All monetary values stored as NUMERIC(15,2)
-- UUIDs used for all primary keys
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- DOMAIN 1: TENANTS & ORGANIZATION
-- =============================================================================

CREATE TABLE tenants (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(100) NOT NULL UNIQUE,          -- e.g. 'forsa-tn', 'forsa-ma'
    country_code        CHAR(2) NOT NULL,                      -- ISO 3166-1 alpha-2
    default_currency    CHAR(3) NOT NULL DEFAULT 'TND',        -- ISO 4217
    default_locale      VARCHAR(10) NOT NULL DEFAULT 'fr-TN',
    status              VARCHAR(50) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','suspended','inactive')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tenants IS
    'Top-level organizational entities. Every record in the system belongs to a tenant.';

-- -----------------------------------------------------------------------------

CREATE TABLE tenant_configs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    config_key          VARCHAR(255) NOT NULL,
    config_value        JSONB NOT NULL,
    version             INTEGER NOT NULL DEFAULT 1,
    effective_date      DATE NOT NULL,
    expiration_date     DATE,
    created_by          UUID,                                  -- references users(id), FK added later
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT tenant_configs_unique_key_version
        UNIQUE (tenant_id, config_key, version)
);

CREATE INDEX idx_tenant_configs_tenant_key
    ON tenant_configs(tenant_id, config_key)
    WHERE expiration_date IS NULL OR expiration_date > CURRENT_DATE;

COMMENT ON TABLE tenant_configs IS
    'Versioned key-value configuration per tenant. Never deleted, only superseded.';

-- =============================================================================
-- DOMAIN 2: USERS, ROLES & PERMISSIONS
-- =============================================================================

CREATE TABLE users (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    email                   VARCHAR(255) NOT NULL,
    email_verified          BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash           TEXT NOT NULL,
    full_name               VARCHAR(255) NOT NULL,
    status                  VARCHAR(50) NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','suspended','deactivated','pending_verification')),
    mfa_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts   INTEGER NOT NULL DEFAULT 0,
    locked_until            TIMESTAMPTZ,
    last_login_at           TIMESTAMPTZ,
    password_changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    must_change_password    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at          TIMESTAMPTZ,
    deactivated_by          UUID REFERENCES users(id),

    CONSTRAINT users_unique_email_per_tenant UNIQUE (tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(tenant_id, status);

COMMENT ON TABLE users IS
    'Internal FORSA employees. Passwords are hashed with bcrypt/argon2 — never stored plain.';

-- -----------------------------------------------------------------------------

CREATE TABLE mfa_configs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    method          VARCHAR(50) NOT NULL
                        CHECK (method IN ('totp','sms','email')),
    secret_encrypted TEXT NOT NULL,                            -- encrypted at application layer
    is_primary      BOOLEAN NOT NULL DEFAULT TRUE,
    status          VARCHAR(50) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','disabled','pending_verification')),
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mfa_configs_user ON mfa_configs(user_id);

-- -----------------------------------------------------------------------------

CREATE TABLE user_sessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    session_token_hash  TEXT NOT NULL UNIQUE,                  -- hash of the session token
    ip_address          INET NOT NULL,
    user_agent          TEXT,
    device_fingerprint  TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    invalidated_at      TIMESTAMPTZ,
    invalidation_reason VARCHAR(100)
                            CHECK (invalidation_reason IN (
                                'logout','expired','admin_revoke',
                                'password_change','mfa_change','suspicious_activity'
                            ))
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token_hash);
CREATE INDEX idx_user_sessions_active
    ON user_sessions(user_id)
    WHERE invalidated_at IS NULL AND expires_at > NOW();

COMMENT ON TABLE user_sessions IS
    'Active and historical session records. Sessions are never deleted — only invalidated.';

-- -----------------------------------------------------------------------------

CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    is_system_role  BOOLEAN NOT NULL DEFAULT FALSE,            -- system roles cannot be deleted
    status          VARCHAR(50) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT roles_unique_name_per_tenant UNIQUE (tenant_id, name)
);

COMMENT ON TABLE roles IS
    'Named roles per tenant. System roles (CEO, Finance, etc.) are seeded and protected.';

-- -----------------------------------------------------------------------------

CREATE TABLE permissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(255) NOT NULL UNIQUE,              -- e.g. 'financing.approve'
    description     TEXT,
    module          VARCHAR(100) NOT NULL,                     -- e.g. 'financing', 'score', 'contract'
    action          VARCHAR(100) NOT NULL,                     -- e.g. 'approve', 'view', 'adjust'
    is_high_impact  BOOLEAN NOT NULL DEFAULT FALSE,            -- requires elevated audit logging
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_permissions_module ON permissions(module);

COMMENT ON TABLE permissions IS
    'Granular named permissions. Codes are stable identifiers used in application code.';

-- -----------------------------------------------------------------------------

CREATE TABLE role_permissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id         UUID NOT NULL REFERENCES roles(id),
    permission_id   UUID NOT NULL REFERENCES permissions(id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by      UUID NOT NULL REFERENCES users(id),

    CONSTRAINT role_permissions_unique UNIQUE (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);

-- -----------------------------------------------------------------------------

CREATE TABLE user_roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    role_id         UUID NOT NULL REFERENCES roles(id),
    effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_until DATE,
    assigned_by     UUID NOT NULL REFERENCES users(id),
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_by      UUID REFERENCES users(id),
    revoked_at      TIMESTAMPTZ,
    revocation_reason TEXT,

    CONSTRAINT user_roles_unique_active
        UNIQUE (user_id, role_id, effective_from)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id)
    WHERE effective_until IS NULL OR effective_until > CURRENT_DATE;

COMMENT ON TABLE user_roles IS
    'Role assignments with effective dates. Revocations are recorded, not deletions.';
