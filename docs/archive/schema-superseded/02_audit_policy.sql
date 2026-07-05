-- =============================================================================
-- FORSA OS — PostgreSQL Database Schema
-- Domain 3: Audit Infrastructure
-- Domain 4: Policy Engine
-- =============================================================================

-- =============================================================================
-- DOMAIN 3: AUDIT INFRASTRUCTURE
-- =============================================================================

CREATE TABLE audit_logs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    user_id             UUID REFERENCES users(id),             -- NULL for system actions
    session_id          UUID REFERENCES user_sessions(id),
    action_type         VARCHAR(255) NOT NULL,                 -- e.g. 'student.created', 'score.adjusted'
    module              VARCHAR(100) NOT NULL,
    target_entity       VARCHAR(100) NOT NULL,                 -- table name
    target_id           UUID NOT NULL,
    previous_value      JSONB,
    new_value           JSONB,
    ip_address          INET,
    device_fingerprint  TEXT,
    reason              TEXT,
    metadata            JSONB,                                 -- additional context
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()

    -- No UPDATE or DELETE permissions should be granted on this table
    -- Enforced via PostgreSQL row security and application role permissions
);

CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_entity, target_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);

COMMENT ON TABLE audit_logs IS
    'Append-only audit trail. No application role is granted UPDATE or DELETE on this table.
     Partitioning by created_at recommended once volume exceeds 10M rows.';

-- -----------------------------------------------------------------------------

CREATE TABLE data_integrity_events (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    event_type              VARCHAR(100) NOT NULL
                                CHECK (event_type IN (
                                    'score_reconciliation_mismatch',
                                    'ledger_balance_mismatch',
                                    'payment_schedule_mismatch',
                                    'execution_ledger_mismatch',
                                    'other'
                                )),
    severity                VARCHAR(50) NOT NULL
                                CHECK (severity IN ('low','medium','high','critical')),
    entity_type             VARCHAR(100) NOT NULL,
    entity_id               UUID NOT NULL,
    expected_value          JSONB NOT NULL,
    stored_value            JSONB NOT NULL,
    difference              JSONB,
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detection_source        VARCHAR(100) NOT NULL,             -- which process detected this
    investigation_status    VARCHAR(50) NOT NULL DEFAULT 'open'
                                CHECK (investigation_status IN (
                                    'open','under_investigation','resolved','escalated'
                                )),
    assigned_owner_id       UUID REFERENCES users(id),
    sla_deadline            TIMESTAMPTZ NOT NULL,
    escalated_at            TIMESTAMPTZ,
    escalated_to_id         UUID REFERENCES users(id),
    resolved_at             TIMESTAMPTZ,
    resolution_notes        TEXT,
    resolution_execution_id UUID                               -- references execution_ledger after correction
);

CREATE INDEX idx_integrity_events_open
    ON data_integrity_events(tenant_id, investigation_status)
    WHERE investigation_status IN ('open','under_investigation','escalated');

CREATE INDEX idx_integrity_events_entity
    ON data_integrity_events(entity_type, entity_id);

COMMENT ON TABLE data_integrity_events IS
    'Records of reconciliation discrepancies and system integrity failures.
     No automatic correction is permitted — all fixes go through the Decision Execution Engine.';

-- =============================================================================
-- DOMAIN 4: POLICY ENGINE
-- =============================================================================

CREATE TYPE policy_scope_type AS ENUM (
    'global',
    'country',
    'university',
    'partner',
    'student',
    'program'
);

CREATE TYPE policy_value_type AS ENUM (
    'numeric',
    'boolean',
    'text',
    'json',
    'enum',
    'date',
    'percentage'
);

CREATE TYPE policy_status AS ENUM (
    'draft',
    'pending_approval',
    'active',
    'superseded',
    'expired',
    'revoked'
);

-- -----------------------------------------------------------------------------

CREATE TABLE policy_definitions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    policy_key      VARCHAR(255) NOT NULL,                     -- e.g. 'score.late_payment.points'
    display_name    VARCHAR(255) NOT NULL,
    description     TEXT,
    module          VARCHAR(100) NOT NULL,
    scope_type      policy_scope_type NOT NULL,
    value_type      policy_value_type NOT NULL,
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,            -- system policies cannot be deleted
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID NOT NULL REFERENCES users(id),

    CONSTRAINT policy_definitions_unique_key UNIQUE (tenant_id, policy_key)
);

CREATE INDEX idx_policy_definitions_tenant_module
    ON policy_definitions(tenant_id, module);

COMMENT ON TABLE policy_definitions IS
    'Master registry of all policy types. Defines what can be configured, not the values.';

-- -----------------------------------------------------------------------------

CREATE TABLE policy_versions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    policy_definition_id UUID NOT NULL REFERENCES policy_definitions(id),
    version             INTEGER NOT NULL,
    scope_type          policy_scope_type NOT NULL,
    scope_id            UUID,                                  -- NULL for global scope
    value               JSONB NOT NULL,
    priority            INTEGER NOT NULL DEFAULT 0,            -- higher = takes precedence
    effective_date      DATE NOT NULL,
    expiration_date     DATE,
    status              policy_status NOT NULL DEFAULT 'draft',
    change_reason       TEXT,
    created_by          UUID NOT NULL REFERENCES users(id),
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT policy_versions_unique UNIQUE (policy_definition_id, scope_type, scope_id, version)

    -- Policies are NEVER deleted. Status changes to 'superseded' or 'expired'.
);

CREATE INDEX idx_policy_versions_active
    ON policy_versions(tenant_id, policy_definition_id, scope_type, scope_id)
    WHERE status = 'active';

CREATE INDEX idx_policy_versions_effective
    ON policy_versions(policy_definition_id, effective_date, expiration_date);

COMMENT ON TABLE policy_versions IS
    'Every version of every policy. Never deleted. Superseded by newer versions with later effective dates.
     Every automated decision must record the policy_version IDs that produced it.';

-- -----------------------------------------------------------------------------

CREATE TABLE policy_conflicts (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    policy_version_a_id     UUID NOT NULL REFERENCES policy_versions(id),
    policy_version_b_id     UUID NOT NULL REFERENCES policy_versions(id),
    conflict_type           VARCHAR(100) NOT NULL
                                CHECK (conflict_type IN (
                                    'overlapping_scope',
                                    'contradictory_values',
                                    'precedence_ambiguity',
                                    'effective_date_overlap'
                                )),
    detection_context       JSONB,                             -- what triggered the conflict detection
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detected_in_run_id      UUID,                             -- pipeline_run reference if detected during evaluation
    resolution_type         VARCHAR(100)
                                CHECK (resolution_type IN (
                                    'precedence_applied',
                                    'manual_override',
                                    'policy_amended',
                                    'unresolved'
                                )),
    resolved_by             UUID REFERENCES users(id),
    resolution_notes        TEXT,
    resolved_at             TIMESTAMPTZ
);

CREATE INDEX idx_policy_conflicts_unresolved
    ON policy_conflicts(tenant_id)
    WHERE resolution_type IS NULL OR resolution_type = 'unresolved';

COMMENT ON TABLE policy_conflicts IS
    'Recorded conflicts between applicable policies. Never silently resolved.
     Every conflict is logged whether or not it was automatically resolved by precedence rules.';
