-- =============================================================================
-- FORSA OS — PostgreSQL Database Schema
-- Domain 8: Applications & Financing Decision Pipeline
-- =============================================================================

CREATE TYPE application_status AS ENUM (
    'new_lead',
    'contacted',
    'waiting_for_documents',
    'documents_received',
    'under_review',
    'approved_level1',
    'approved_level2',
    'approved_level3',
    'rejected',
    'on_hold',
    'capital_queue',
    'contract_sent',
    'contract_signed',
    'university_paid',
    'active_student',
    'completed',
    'withdrawn',
    'appealing'
);

CREATE TYPE financing_level AS ENUM (
    'level1',
    'level2',
    'level3'
);

CREATE TYPE decision_result AS ENUM (
    'approved_level1',
    'approved_level2',
    'approved_level3',
    'rejected',
    'on_hold',
    'needs_more_documents',
    'needs_manual_review',
    'needs_guarantor_review',
    'needs_university_confirmation',
    'capital_queue'
);

CREATE TYPE pipeline_run_status AS ENUM (
    'active',
    'completed',
    'cancelled',
    'superseded'
);

CREATE TYPE approval_sequencing AS ENUM (
    'sequential',
    'parallel',
    'hybrid'
);

-- =============================================================================
-- APPLICATIONS
-- =============================================================================

CREATE TABLE applications (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    student_id                  UUID NOT NULL REFERENCES students(id),
    university_id               UUID NOT NULL REFERENCES universities(id),
    program_id                  UUID REFERENCES programs(id),
    agreement_id                UUID REFERENCES university_agreements(id),  -- pinned at pipeline run
    referral_source_id          UUID REFERENCES referral_sources(id),
    partner_id                  UUID REFERENCES partners(id),
    campaign_id                 UUID REFERENCES campaigns(id),
    -- Financial details
    tuition_amount              NUMERIC(15,2) NOT NULL,
    requested_support_amount    NUMERIC(15,2),
    currency                    CHAR(3) NOT NULL DEFAULT 'TND',
    academic_year               VARCHAR(20),
    -- Status
    current_status              application_status NOT NULL DEFAULT 'new_lead',
    current_pipeline_run_id     UUID,                          -- FK added below after pipeline_runs
    current_financing_level     financing_level,
    -- Tracking
    lead_date                   DATE NOT NULL DEFAULT CURRENT_DATE,
    assigned_to_user_id         UUID REFERENCES users(id),
    is_renewal                  BOOLEAN NOT NULL DEFAULT FALSE,
    previous_application_id     UUID REFERENCES applications(id),
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by                  UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_applications_tenant ON applications(tenant_id);
CREATE INDEX idx_applications_student ON applications(student_id);
CREATE INDEX idx_applications_status ON applications(tenant_id, current_status);
CREATE INDEX idx_applications_university ON applications(university_id);

-- Back-reference from students to application
ALTER TABLE students
    ADD CONSTRAINT fk_students_created_from_application
    FOREIGN KEY (created_from_application_id) REFERENCES applications(id);

-- -----------------------------------------------------------------------------

CREATE TABLE application_status_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id  UUID NOT NULL REFERENCES applications(id),
    from_status     application_status,
    to_status       application_status NOT NULL,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by      UUID REFERENCES users(id),                 -- NULL for system transitions
    reason          TEXT,
    pipeline_run_id UUID,                                      -- FK added below
    notes           TEXT
);

CREATE INDEX idx_app_status_history_application
    ON application_status_history(application_id, changed_at DESC);

COMMENT ON TABLE application_status_history IS
    'Append-only status change log. Every status transition is a new record.
     The valid state machine transitions are enforced at the application layer.';

-- =============================================================================
-- PIPELINE RUNS
-- =============================================================================

CREATE TABLE pipeline_runs (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    application_id          UUID NOT NULL REFERENCES applications(id),
    run_number              INTEGER NOT NULL,                  -- sequential per application
    status                  pipeline_run_status NOT NULL DEFAULT 'active',
    reentry_stage           INTEGER,                           -- stage number where this run resumed
    reentry_reason          TEXT,
    cancellation_reason     TEXT,
    cancelled_at            TIMESTAMPTZ,
    cancelled_by            UUID REFERENCES users(id),
    cancelled_by_process    VARCHAR(100),                      -- if cancelled by automated process
    superseding_run_id      UUID REFERENCES pipeline_runs(id),
    initiated_by            UUID REFERENCES users(id),
    initiated_by_process    VARCHAR(100),
    initiated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,

    CONSTRAINT pipeline_runs_unique_number UNIQUE (application_id, run_number)
);

CREATE INDEX idx_pipeline_runs_application ON pipeline_runs(application_id);
CREATE INDEX idx_pipeline_runs_active
    ON pipeline_runs(application_id, status)
    WHERE status = 'active';

-- Add FK now that pipeline_runs exists
ALTER TABLE applications
    ADD CONSTRAINT fk_applications_current_run
    FOREIGN KEY (current_pipeline_run_id) REFERENCES pipeline_runs(id);

ALTER TABLE application_status_history
    ADD CONSTRAINT fk_status_history_run
    FOREIGN KEY (pipeline_run_id) REFERENCES pipeline_runs(id);

COMMENT ON TABLE pipeline_runs IS
    'Each independent traversal of the Financing Decision Pipeline.
     Cancelled runs are never deleted. Every run is linked to its application.
     Previous runs are immutable once cancelled or completed.';

-- =============================================================================
-- PIPELINE STAGE RECORDS
-- =============================================================================

CREATE TABLE pipeline_stage_records (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id     UUID NOT NULL REFERENCES pipeline_runs(id),
    stage_number        INTEGER NOT NULL CHECK (stage_number BETWEEN 1 AND 10),
    stage_name          VARCHAR(100) NOT NULL,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    stage_status        VARCHAR(50) NOT NULL DEFAULT 'in_progress'
                            CHECK (stage_status IN (
                                'in_progress','completed','failed','skipped'
                            )),
    inputs              JSONB,                                 -- structured stage inputs snapshot
    outputs             JSONB,                                 -- structured stage outputs
    decision            VARCHAR(100),                          -- stage-level decision/outcome
    reviewer_id         UUID REFERENCES users(id),            -- Stage 8 reviewer
    policy_version_ids  UUID[],                                -- policies applied at this stage
    audit_notes         TEXT,

    CONSTRAINT pipeline_stage_unique UNIQUE (pipeline_run_id, stage_number)
);

CREATE INDEX idx_stage_records_run ON pipeline_stage_records(pipeline_run_id);

-- =============================================================================
-- STAGE 4: RISK PROFILES
-- =============================================================================

CREATE TABLE risk_profiles (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id         UUID NOT NULL UNIQUE REFERENCES pipeline_runs(id),
    student_risk_indicators JSONB NOT NULL,
    guarantor_risk_indicators JSONB NOT NULL,
    financial_risk_indicators JSONB NOT NULL,
    communication_indicators  JSONB,
    historical_indicators     JSONB,                           -- previous FORSA relationship
    composite_risk_level    VARCHAR(50) NOT NULL
                                CHECK (composite_risk_level IN (
                                    'very_low','low','medium','high','very_high'
                                )),
    risk_flags              TEXT[],                            -- specific risk flags triggered
    policy_version_id       UUID NOT NULL REFERENCES policy_versions(id),
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE risk_profiles IS
    'Structured risk assessment output of Stage 4.
     No financing level is assigned here — that occurs in Stage 5.';

-- =============================================================================
-- STAGE 5: DECISION CONFIDENCE SCORES & CANDIDATE DECISIONS
-- =============================================================================

CREATE TYPE dcs_band AS ENUM (
    'very_high',    -- 90-100
    'high',         -- 75-89
    'medium',       -- 60-74
    'low'           -- below 60
);

CREATE TABLE decision_confidence_scores (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id         UUID NOT NULL UNIQUE REFERENCES pipeline_runs(id),
    score                   NUMERIC(5,2) NOT NULL
                                CHECK (score >= 0 AND score <= 100),
    band                    dcs_band NOT NULL,
    -- Structured explainability (locked input categories)
    confidence_contributors JSONB NOT NULL,                    -- array of {factor, direction, weight, current_value, target_value}
    confidence_reducers     JSONB NOT NULL,
    missing_information     JSONB,
    policy_uncertainty      JSONB,
    portfolio_uncertainty   JSONB,
    data_quality_issues     JSONB,
    -- Governance
    mandatory_review_required BOOLEAN NOT NULL DEFAULT FALSE,
    policy_version_id       UUID NOT NULL REFERENCES policy_versions(id),
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE decision_confidence_scores IS
    'DCS is recalculated fresh for every Pipeline Run — never inherited.
     Factor weights are stored in policy_versions and never shown to reviewers.
     This record is immutable after creation.';

-- -----------------------------------------------------------------------------

CREATE TABLE candidate_decisions (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id             UUID NOT NULL UNIQUE REFERENCES pipeline_runs(id),
    recommended_level           financing_level,
    recommended_amount          NUMERIC(15,2),
    conditions                  JSONB,                         -- conditional requirements
    policy_conflict_ids         UUID[],                        -- references to policy_conflicts
    detected_conflicts_summary  JSONB,
    policy_version_ids          UUID[] NOT NULL,
    computed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- STAGE 6: CAPITAL QUEUE
-- =============================================================================

CREATE TABLE capital_queue_entries (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    application_id              UUID NOT NULL REFERENCES applications(id),
    pipeline_run_id             UUID NOT NULL REFERENCES pipeline_runs(id),
    -- Queue management
    queue_entry_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    priority_score              NUMERIC(8,4),
    priority_factors            JSONB NOT NULL,                -- weighted factors used
    priority_policy_version_id  UUID REFERENCES policy_versions(id),
    -- Capital details
    capital_requirement         NUMERIC(15,2) NOT NULL,
    currency                    CHAR(3) NOT NULL DEFAULT 'TND',
    portfolio_snapshot          JSONB NOT NULL,                -- portfolio state at entry time
    -- Timing
    max_queue_duration_days     INTEGER NOT NULL,
    estimated_review_date       DATE,
    sla_expiry_date             DATE NOT NULL,
    -- Status
    status                      VARCHAR(50) NOT NULL DEFAULT 'queued'
                                    CHECK (status IN (
                                        'queued','reactivated','expired',
                                        'cancelled','converted'
                                    )),
    exit_date                   TIMESTAMPTZ,
    exit_reason                 VARCHAR(100),
    -- Student-facing message (never reveals internal capital position)
    student_notification_text   TEXT NOT NULL DEFAULT
                                    'Your application is currently under operational review.',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_capital_queue_active
    ON capital_queue_entries(tenant_id, status, priority_score DESC)
    WHERE status = 'queued';

CREATE INDEX idx_capital_queue_expiry
    ON capital_queue_entries(sla_expiry_date)
    WHERE status = 'queued';

-- =============================================================================
-- STAGE 7: APPROVAL SETS
-- =============================================================================

CREATE TABLE approval_sets (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id     UUID NOT NULL UNIQUE REFERENCES pipeline_runs(id),
    sequencing_type     approval_sequencing NOT NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                                'pending','in_progress','completed','rejected','expired'
                            )),
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------

CREATE TABLE approval_set_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_set_id     UUID NOT NULL REFERENCES approval_sets(id),
    sequence_order      INTEGER NOT NULL,                      -- used for sequential/hybrid
    required_role       VARCHAR(100) NOT NULL,                 -- role code
    assigned_user_id    UUID REFERENCES users(id),
    status              VARCHAR(50) NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                                'pending','available','approved','rejected',
                                'delegated','expired'
                            )),
    decision            VARCHAR(50)
                            CHECK (decision IN ('approved','rejected','approved_with_conditions')),
    decision_notes      TEXT,
    conditions          JSONB,
    decided_at          TIMESTAMPTZ,
    available_from      TIMESTAMPTZ,                           -- for sequential: when this step unlocks
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT approval_set_items_unique_sequence
        UNIQUE (approval_set_id, sequence_order)
);

CREATE INDEX idx_approval_items_pending
    ON approval_set_items(assigned_user_id, status)
    WHERE status IN ('pending','available');

-- =============================================================================
-- STAGE 8: REVIEWER SNAPSHOTS
-- =============================================================================

CREATE TABLE reviewer_snapshots (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id         UUID NOT NULL REFERENCES pipeline_runs(id),
    approval_set_item_id    UUID REFERENCES approval_set_items(id),
    snapshot_content        JSONB NOT NULL,                    -- complete data shown to reviewer
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- This table has no updated_at — records are immutable after creation
    -- No UPDATE permissions granted at application role level
);

COMMENT ON TABLE reviewer_snapshots IS
    'Immutable record of exactly what each reviewer saw when making their decision.
     Never updated after creation. Critical for audit and legal defensibility.';

-- =============================================================================
-- STAGE 9: FINANCING DECISIONS
-- =============================================================================

CREATE TABLE financing_decisions (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    application_id              UUID NOT NULL REFERENCES applications(id),
    pipeline_run_id             UUID NOT NULL UNIQUE REFERENCES pipeline_runs(id),
    -- Decision output
    decision_result             decision_result NOT NULL,
    approved_level              financing_level,
    approved_amount             NUMERIC(15,2),
    currency                    CHAR(3) DEFAULT 'TND',
    conditions                  JSONB,
    payment_model               payment_model_type,
    agreement_version_id        UUID REFERENCES university_agreements(id),  -- pinned version
    -- Explainability
    explanation                 JSONB NOT NULL,                -- structured explanation
    reason_codes                TEXT[],
    policy_version_ids          UUID[] NOT NULL,
    risk_profile_id             UUID REFERENCES risk_profiles(id),
    dcs_id                      UUID REFERENCES decision_confidence_scores(id),
    -- Decision type classification
    decision_type               VARCHAR(100) NOT NULL
                                    CHECK (decision_type IN (
                                        'policy_compliant',
                                        'policy_exception',
                                        'manual_override'
                                    )),
    -- Audit
    decided_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_by                  UUID REFERENCES users(id),     -- NULL if fully automated
    pipeline_execution_trace_id UUID                           -- FK added below
);

CREATE INDEX idx_financing_decisions_application
    ON financing_decisions(application_id);

-- =============================================================================
-- PIPELINE EXECUTION TRACES
-- =============================================================================

CREATE TABLE pipeline_execution_traces (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id     UUID NOT NULL UNIQUE REFERENCES pipeline_runs(id),
    stage_record_ids    UUID[] NOT NULL,                       -- ordered array of stage record refs
    completed_stages    INTEGER[] NOT NULL,
    final_outcome       decision_result,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Complete the FK on financing_decisions
ALTER TABLE financing_decisions
    ADD CONSTRAINT fk_financing_decisions_trace
    FOREIGN KEY (pipeline_execution_trace_id)
    REFERENCES pipeline_execution_traces(id);

-- =============================================================================
-- APPEALS
-- =============================================================================

CREATE TABLE application_appeals (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    application_id              UUID NOT NULL REFERENCES applications(id),
    original_decision_id        UUID NOT NULL REFERENCES financing_decisions(id),
    -- Timing
    submitted_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_by                UUID REFERENCES users(id),
    deadline_for_review         TIMESTAMPTZ NOT NULL,
    -- Content
    appeal_reason               TEXT NOT NULL,
    new_evidence_description    TEXT,
    reentry_stage               INTEGER,                       -- which stage new evidence warrants
    -- Status
    status                      VARCHAR(50) NOT NULL DEFAULT 'submitted'
                                    CHECK (status IN (
                                        'submitted','under_review','accepted',
                                        'rejected','partially_accepted','requires_more_evidence'
                                    )),
    -- Outcome
    reviewer_id                 UUID REFERENCES users(id),
    review_notes                TEXT,
    resolved_at                 TIMESTAMPTZ,
    resulting_pipeline_run_id   UUID REFERENCES pipeline_runs(id),
    execution_ledger_id         UUID                           -- set if DEE acted on accepted appeal
);

CREATE INDEX idx_appeals_application ON application_appeals(application_id);
CREATE INDEX idx_appeals_open
    ON application_appeals(tenant_id, status)
    WHERE status IN ('submitted','under_review');
