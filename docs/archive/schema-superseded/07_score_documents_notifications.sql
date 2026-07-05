-- =============================================================================
-- FORSA OS — PostgreSQL Database Schema
-- Domain 12: FORSA Score Engine
-- Domain 13: Document Management
-- Domain 14: Notifications
-- =============================================================================

-- =============================================================================
-- DOMAIN 12: FORSA SCORE ENGINE
-- =============================================================================

CREATE TYPE score_dimension AS ENUM (
    'payment_reliability',
    'documentation_reliability',
    'communication_reliability',
    'academic_continuity',
    'guarantor_reliability'
);

CREATE TYPE score_severity AS ENUM (
    'standard',     -- normal decay applies
    'elevated',     -- slower decay
    'severe'        -- permanent residual impact per policy floor
);

CREATE TYPE score_band AS ENUM (
    'high_risk',        -- 300-499
    'medium_trust',     -- 500-649
    'good_trust',       -- 650-799
    'very_good_trust',  -- 800-899
    'elite_trust'       -- 900-1000
);

-- -----------------------------------------------------------------------------
-- Running Balance (performance cache — event history is source of truth)
-- -----------------------------------------------------------------------------

CREATE TABLE forsa_scores (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    student_id              UUID NOT NULL UNIQUE REFERENCES students(id),
    aggregate_score         NUMERIC(6,2) NOT NULL DEFAULT 500
                                CHECK (aggregate_score >= 300 AND aggregate_score <= 1000),
    score_band              score_band NOT NULL DEFAULT 'medium_trust',
    -- Ceiling enforcement (Section 3, Decision 1 refinement)
    ceiling_active          BOOLEAN NOT NULL DEFAULT FALSE,
    ceiling_reason          TEXT,
    ceiling_max_score       NUMERIC(6,2),                      -- max allowed while ceiling active
    ceiling_source_event_id UUID,                              -- score_event that triggered ceiling
    -- Governance
    policy_version_id       UUID NOT NULL REFERENCES policy_versions(id),
    last_computed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reconciled_at      TIMESTAMPTZ,
    next_reconciliation_due TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forsa_scores_tenant ON forsa_scores(tenant_id);
CREATE INDEX idx_forsa_scores_band ON forsa_scores(tenant_id, score_band);
CREATE INDEX idx_forsa_scores_reconciliation_due
    ON forsa_scores(next_reconciliation_due)
    WHERE next_reconciliation_due < NOW();

COMMENT ON TABLE forsa_scores IS
    'Running balance cache. The score_events table is the source of truth.
     Running balance exists for query performance only.
     Ceiling fields enforce dimension-level score caps (e.g. fraud blocks Elite Trust).
     Ceiling is lifted automatically when its source event is superseded by an appeal.';

-- -----------------------------------------------------------------------------

CREATE TABLE score_dimension_balances (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    student_id          UUID NOT NULL REFERENCES students(id),
    dimension           score_dimension NOT NULL,
    current_score       NUMERIC(6,2) NOT NULL DEFAULT 0,
    last_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    policy_version_id   UUID NOT NULL REFERENCES policy_versions(id),

    CONSTRAINT score_dimension_unique UNIQUE (student_id, dimension)
);

CREATE INDEX idx_dimension_balances_student ON score_dimension_balances(student_id);

COMMENT ON TABLE score_dimension_balances IS
    'Per-dimension running balances. Required for dimension-level history in dashboards.
     Updated alongside forsa_scores by the same atomic operation.
     Source of truth remains score_events.';

-- -----------------------------------------------------------------------------
-- Score Events — Immutable Append-Only Source of Truth
-- -----------------------------------------------------------------------------

CREATE TABLE score_events (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    student_id                  UUID NOT NULL REFERENCES students(id),
    -- Event classification
    event_type                  VARCHAR(100) NOT NULL,         -- controlled vocabulary
    dimension                   score_dimension NOT NULL,
    severity                    score_severity NOT NULL DEFAULT 'standard',
    source_trust_level          source_trust_level NOT NULL,
    -- Score impact (never modified after creation)
    original_points             NUMERIC(6,2) NOT NULL,         -- positive or negative
    -- Time decay is computed at query time, NOT stored here
    -- The original_points value is immutable forever
    -- Supersession state
    is_superseded               BOOLEAN NOT NULL DEFAULT FALSE, -- set TRUE when corrected by appeal
    -- References
    related_business_event_type VARCHAR(100),                  -- 'payment','document','enrollment' etc
    related_business_event_id   UUID,
    related_execution_id        UUID REFERENCES execution_ledger(id),
    -- Policy & reason
    policy_version_id           UUID NOT NULL REFERENCES policy_versions(id),
    reason_code                 VARCHAR(100) NOT NULL,         -- controlled vocabulary
    reason_detail               TEXT,
    -- Attribution
    triggered_by_user_id        UUID REFERENCES users(id),    -- NULL if automated
    triggered_by_process        VARCHAR(100),                  -- process name if automated
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()

    -- IMMUTABLE: no UPDATE or DELETE after creation
    -- is_superseded is the only field that changes — handled via score_event_supersessions
);

CREATE INDEX idx_score_events_student ON score_events(student_id, created_at DESC);
CREATE INDEX idx_score_events_dimension ON score_events(student_id, dimension);
CREATE INDEX idx_score_events_active
    ON score_events(student_id)
    WHERE is_superseded = FALSE;
CREATE INDEX idx_score_events_type ON score_events(event_type, tenant_id);

COMMENT ON TABLE score_events IS
    'Immutable append-only source of truth for FORSA Score.
     original_points is NEVER modified. Time decay is applied at computation time.
     is_superseded marks corrected events — zero contribution to score computation.
     Corrected events remain permanently visible for audit.';

-- Exception: allow is_superseded to be set TRUE (only via trigger, not direct update)
-- We enforce this via a restricted trigger rather than full immutability
CREATE OR REPLACE FUNCTION enforce_score_event_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only allow setting is_superseded from FALSE to TRUE
    -- All other field modifications are rejected
    IF OLD.is_superseded = FALSE AND NEW.is_superseded = TRUE
       AND OLD.id = NEW.id
       AND OLD.tenant_id = NEW.tenant_id
       AND OLD.student_id = NEW.student_id
       AND OLD.event_type = NEW.event_type
       AND OLD.dimension = NEW.dimension
       AND OLD.severity = NEW.severity
       AND OLD.original_points = NEW.original_points
       AND OLD.policy_version_id = NEW.policy_version_id
       AND OLD.reason_code = NEW.reason_code
       AND OLD.created_at = NEW.created_at
    THEN
        RETURN NEW; -- Only allow this specific mutation
    END IF;

    RAISE EXCEPTION
        'Score event immutability violation: only is_superseded flag may be set to TRUE. '
        'All other fields are immutable. Event id=%.', OLD.id;
    RETURN NULL;
END;
$$;

CREATE TRIGGER enforce_score_event_immutability
    BEFORE UPDATE ON score_events
    FOR EACH ROW EXECUTE FUNCTION enforce_score_event_immutability();

CREATE TRIGGER prevent_score_event_delete
    BEFORE DELETE ON score_events
    FOR EACH ROW EXECUTE FUNCTION enforce_immutable_row();

-- -----------------------------------------------------------------------------

CREATE TABLE score_event_supersessions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    original_event_id       UUID NOT NULL REFERENCES score_events(id),
    corrective_event_id     UUID NOT NULL REFERENCES score_events(id),
    appeal_id               UUID REFERENCES application_appeals(id),
    exceptional_event_id    UUID REFERENCES student_exceptional_events(id),
    superseded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    superseded_by_user_id   UUID NOT NULL REFERENCES users(id),
    reason                  TEXT NOT NULL,
    -- Backdating rules (Section 3 governance)
    effective_date_override DATE,                              -- cannot predate original_event created_at
    execution_ledger_id     UUID NOT NULL REFERENCES execution_ledger(id),

    CONSTRAINT supersession_unique UNIQUE (original_event_id),  -- one correction per event
    CONSTRAINT no_self_supersession CHECK (original_event_id != corrective_event_id)
);

COMMENT ON TABLE score_event_supersessions IS
    'Records corrective supersessions from successful appeals.
     One-to-one: each original event has at most one supersession.
     Corrective events begin their lifecycle from their creation date.
     Effective date override cannot predate the original event timestamp.';

-- -----------------------------------------------------------------------------
-- Reconciliation
-- -----------------------------------------------------------------------------

CREATE TABLE score_reconciliation_logs (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    student_id                  UUID NOT NULL REFERENCES students(id),
    trigger_type                VARCHAR(100) NOT NULL
                                    CHECK (trigger_type IN (
                                        'new_score_event',
                                        'manual_adjustment',
                                        'successful_appeal',
                                        'data_migration',
                                        'scheduled_job',
                                        'manual_trigger'
                                    )),
    replayed_score              NUMERIC(6,2) NOT NULL,
    stored_score                NUMERIC(6,2) NOT NULL,
    score_difference            NUMERIC(6,2) NOT NULL
                                    GENERATED ALWAYS AS (replayed_score - stored_score) STORED,
    replayed_dimension_scores   JSONB NOT NULL,                -- {dimension: score} map
    stored_dimension_scores     JSONB NOT NULL,
    policy_version_id           UUID NOT NULL REFERENCES policy_versions(id),
    discrepancy_detected        BOOLEAN NOT NULL DEFAULT FALSE,
    data_integrity_event_id     UUID REFERENCES data_integrity_events(id),
    started_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at                TIMESTAMPTZ
);

CREATE INDEX idx_reconciliation_student ON score_reconciliation_logs(student_id, started_at DESC);
CREATE INDEX idx_reconciliation_discrepancies
    ON score_reconciliation_logs(tenant_id)
    WHERE discrepancy_detected = TRUE;

-- -----------------------------------------------------------------------------
-- Manual Adjustments
-- -----------------------------------------------------------------------------

CREATE TABLE score_manual_adjustments (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    student_id              UUID NOT NULL REFERENCES students(id),
    adjustment_reason_code  VARCHAR(100) NOT NULL               -- controlled vocabulary
                                CHECK (adjustment_reason_code IN (
                                    'data_correction',
                                    'appeal_resolution',
                                    'exceptional_event_resolution',
                                    'legal_compliance',
                                    'migration_cleanup',
                                    'policy_correction'
                                )),
    explanation             TEXT NOT NULL,
    related_case_id         UUID,                              -- appeal or exceptional_event reference
    related_case_type       VARCHAR(50),
    requested_by            UUID NOT NULL REFERENCES users(id),
    approved_by             UUID REFERENCES users(id),         -- required above policy threshold
    approved_at             TIMESTAMPTZ,
    resulting_score_event_id UUID REFERENCES score_events(id),
    execution_ledger_id     UUID NOT NULL REFERENCES execution_ledger(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE score_manual_adjustments IS
    'All manual adjustments are recorded here before producing Score Events.
     No direct score editing. Manual adjustments MUST create Score Events via DEE.';


-- =============================================================================
-- DOMAIN 13: DOCUMENT MANAGEMENT
-- =============================================================================

CREATE TYPE document_status AS ENUM (
    'absent',
    'uploaded',
    'under_review',
    'verified',
    'rejected',
    'expired',
    'superseded'
);

-- -----------------------------------------------------------------------------

CREATE TABLE document_types (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    code                    VARCHAR(100) NOT NULL,             -- controlled vocabulary
    display_name            VARCHAR(255) NOT NULL,
    description             TEXT,
    -- Requirements
    required_for_levels     TEXT[],                            -- ['level1','level2']
    required_for_stages     TEXT[],                            -- ['stage1','stage4']
    required_for_roles      TEXT[],                            -- ['student','guarantor']
    -- Expiry rules
    tracks_expiry           BOOLEAN NOT NULL DEFAULT FALSE,
    expiry_warning_days     INTEGER DEFAULT 30,
    -- Status
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT document_types_unique_code UNIQUE (tenant_id, code)
);

-- -----------------------------------------------------------------------------

CREATE TABLE documents (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    -- Owner (polymorphic reference)
    owner_type              VARCHAR(50) NOT NULL
                                CHECK (owner_type IN (
                                    'student','guarantor','university',
                                    'partner','application','contract'
                                )),
    owner_id                UUID NOT NULL,
    document_type_id        UUID NOT NULL REFERENCES document_types(id),
    -- Storage (S3 reference only — no binary data in DB)
    storage_key             TEXT,                              -- S3 object key
    storage_bucket          VARCHAR(255),                      -- bucket name (env-configured)
    file_hash               TEXT,                              -- SHA-256 of original file
    file_size_bytes         BIGINT,
    mime_type               VARCHAR(100),
    original_filename       TEXT,                              -- sanitized original name
    -- Encryption
    encryption_key_version_id UUID REFERENCES encryption_key_versions(id),
    -- Status
    status                  document_status NOT NULL DEFAULT 'absent',
    -- Verification
    uploaded_by             UUID REFERENCES users(id),
    uploaded_at             TIMESTAMPTZ,
    source_trust_level      source_trust_level,
    verified_by             UUID REFERENCES users(id),
    verified_at             TIMESTAMPTZ,
    rejection_reason        TEXT,
    rejected_by             UUID REFERENCES users(id),
    rejected_at             TIMESTAMPTZ,
    -- Expiry
    expiry_date             DATE,
    expiry_warned_at        TIMESTAMPTZ,
    -- Audit
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_owner ON documents(owner_type, owner_id);
CREATE INDEX idx_documents_status ON documents(tenant_id, status);
CREATE INDEX idx_documents_expiry
    ON documents(expiry_date)
    WHERE status = 'verified' AND expiry_date IS NOT NULL;
CREATE INDEX idx_documents_type ON documents(document_type_id, status);

COMMENT ON TABLE documents IS
    'Document metadata only. No binary content stored in PostgreSQL.
     S3 storage key references the actual file.
     Access requires a valid document_access_token.';

-- -----------------------------------------------------------------------------

CREATE TABLE document_versions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id             UUID NOT NULL REFERENCES documents(id),
    version_number          INTEGER NOT NULL,
    previous_storage_key    TEXT NOT NULL,
    previous_file_hash      TEXT NOT NULL,
    previous_status         document_status NOT NULL,
    replaced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    replaced_by             UUID NOT NULL REFERENCES users(id),
    replacement_reason      TEXT,

    CONSTRAINT document_versions_unique UNIQUE (document_id, version_number)
);

-- -----------------------------------------------------------------------------

CREATE TABLE document_access_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    document_id     UUID NOT NULL,                             -- references documents(id)
    accessed_by     UUID NOT NULL REFERENCES users(id),
    access_type     VARCHAR(50) NOT NULL
                        CHECK (access_type IN (
                            'view','download','verify',
                            'reject','sign','admin_review','audit'
                        )),
    token_id        UUID REFERENCES document_access_tokens(id),
    ip_address      INET,
    session_id      UUID REFERENCES user_sessions(id),
    accessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()

    -- Append-only
);

CREATE INDEX idx_doc_access_document ON document_access_logs(document_id, accessed_at DESC);
CREATE INDEX idx_doc_access_user ON document_access_logs(accessed_by, accessed_at DESC);


-- =============================================================================
-- DOMAIN 14: NOTIFICATIONS & OUTBOX
-- =============================================================================

CREATE TABLE notification_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    notification_type VARCHAR(100) NOT NULL,                   -- e.g. 'payment_reminder'
    channel         VARCHAR(50) NOT NULL
                        CHECK (channel IN (
                            'email','sms','whatsapp','in_app','push'
                        )),
    locale          VARCHAR(10) NOT NULL DEFAULT 'fr-TN',
    version         INTEGER NOT NULL DEFAULT 1,
    subject_template TEXT,                                     -- for email
    body_template   TEXT NOT NULL,                             -- mustache/handlebars template
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID NOT NULL REFERENCES users(id),

    CONSTRAINT notification_templates_unique
        UNIQUE (tenant_id, notification_type, channel, locale, version)
);

-- -----------------------------------------------------------------------------

CREATE TABLE notification_logs (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    -- Recipient
    recipient_type          VARCHAR(50) NOT NULL
                                CHECK (recipient_type IN (
                                    'student','user','guarantor','partner','university'
                                )),
    recipient_id            UUID NOT NULL,
    recipient_contact       TEXT,                              -- email/phone used (masked in logs)
    -- Content
    channel                 VARCHAR(50) NOT NULL,
    template_id             UUID REFERENCES notification_templates(id),
    template_version        INTEGER,
    subject                 TEXT,
    -- Delivery
    status                  VARCHAR(50) NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                    'pending','sent','delivered',
                                    'failed','bounced','unsubscribed'
                                )),
    outbox_event_id         UUID REFERENCES outbox_events(id),
    external_message_id     TEXT,                             -- provider's message ID
    sent_at                 TIMESTAMPTZ,
    delivered_at            TIMESTAMPTZ,
    failure_reason          TEXT,
    retry_count             INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()

    -- Append-only
);

CREATE INDEX idx_notification_logs_recipient
    ON notification_logs(recipient_type, recipient_id, created_at DESC);
CREATE INDEX idx_notification_logs_status
    ON notification_logs(tenant_id, status)
    WHERE status IN ('pending','failed');
