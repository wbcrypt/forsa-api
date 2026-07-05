-- =============================================================================
-- FORSA OS — PostgreSQL Database Schema
-- Domain 9: Decision Execution Engine & Outbox
-- Domain 10: Contracts
-- Domain 11: Payments & Financial Ledger
-- =============================================================================

-- =============================================================================
-- DOMAIN 9: DECISION EXECUTION ENGINE
-- =============================================================================

CREATE TYPE execution_status AS ENUM (
    'pending',
    'executing',
    'committed',
    'rolled_back',
    'failed',
    'duplicate_rejected'
);

-- -----------------------------------------------------------------------------

CREATE TABLE execution_requests (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idempotency_key     TEXT NOT NULL UNIQUE,                  -- globally unique per execution intent
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    decision_type       VARCHAR(100) NOT NULL,                 -- what kind of decision is being executed
    decision_reference_type VARCHAR(100),                      -- 'financing_decision','appeal','exceptional_event' etc
    decision_reference_id   UUID,
    requested_by        UUID REFERENCES users(id),
    requested_by_process VARCHAR(100),
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              execution_status NOT NULL DEFAULT 'pending',
    original_request_id UUID REFERENCES execution_requests(id) -- set if this was a duplicate
);

CREATE INDEX idx_execution_requests_key ON execution_requests(idempotency_key);
CREATE INDEX idx_execution_requests_status ON execution_requests(status);

COMMENT ON TABLE execution_requests IS
    'Every request submitted to the Decision Execution Engine.
     Idempotency key is globally unique. Duplicate keys return the original result.
     The engine rejects any second execution of the same idempotency key.';

-- -----------------------------------------------------------------------------

CREATE TABLE execution_ledger (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_request_id    UUID NOT NULL UNIQUE REFERENCES execution_requests(id),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    -- Who and when
    triggering_user_id      UUID REFERENCES users(id),
    triggering_process      VARCHAR(100),
    triggered_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Approval chain
    approval_chain          JSONB NOT NULL DEFAULT '[]',       -- ordered array of approvals
    -- What happened
    executed_actions        JSONB NOT NULL DEFAULT '[]',       -- array of action descriptors
    affected_objects        JSONB NOT NULL DEFAULT '[]',       -- {type, id, table} references
    before_state            JSONB NOT NULL,                    -- snapshot before execution
    after_state             JSONB NOT NULL,                    -- snapshot after execution
    -- Outcome
    execution_status        execution_status NOT NULL,
    committed_at            TIMESTAMPTZ,
    rollback_information    JSONB,                             -- populated on rolled_back status
    failure_reason          TEXT,

    -- This table is append-only — no UPDATE or DELETE
    CONSTRAINT execution_ledger_committed_has_timestamp
        CHECK (
            execution_status != 'committed'
            OR committed_at IS NOT NULL
        )
);

CREATE INDEX idx_execution_ledger_tenant ON execution_ledger(tenant_id, triggered_at DESC);
CREATE INDEX idx_execution_ledger_affected
    ON execution_ledger USING GIN (affected_objects);

COMMENT ON TABLE execution_ledger IS
    'Immutable record of every Decision Execution Engine run.
     Append-only. No UPDATE or DELETE permissions at application role level.
     This is one of the platform''s core audit components.';

-- -----------------------------------------------------------------------------

CREATE TABLE outbox_events (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    idempotency_key     TEXT NOT NULL UNIQUE,
    event_type          VARCHAR(255) NOT NULL,                 -- e.g. 'notification.send', 'score.update'
    target_service      VARCHAR(100) NOT NULL,                 -- e.g. 'notification_service', 'score_engine'
    payload             JSONB NOT NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                                'pending','processing','delivered','failed','dead_letter'
                            )),
    execution_ledger_id UUID REFERENCES execution_ledger(id), -- the execution that created this event
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    process_after       TIMESTAMPTZ NOT NULL DEFAULT NOW(),    -- supports delayed delivery
    processed_at        TIMESTAMPTZ,
    retry_count         INTEGER NOT NULL DEFAULT 0,
    max_retries         INTEGER NOT NULL DEFAULT 5,
    last_error          TEXT,
    dead_lettered_at    TIMESTAMPTZ
);

CREATE INDEX idx_outbox_pending
    ON outbox_events(status, process_after)
    WHERE status IN ('pending','failed') AND retry_count < max_retries;

COMMENT ON TABLE outbox_events IS
    'Transactional outbox pattern: events are written in the same DB transaction as
     financial changes, then delivered asynchronously. Guarantees eventual delivery
     without distributed transaction risk.';

-- =============================================================================
-- DOMAIN 10: CONTRACTS
-- =============================================================================

CREATE TYPE contract_type AS ENUM (
    'student_forsa',
    'forsa_university',
    'student_university',
    'guarantor_forsa'
);

CREATE TYPE contract_status AS ENUM (
    'draft',
    'sent_for_signature',
    'partially_signed',
    'fully_signed',
    'active',
    'amended',
    'terminated',
    'expired',
    'voided'
);

-- -----------------------------------------------------------------------------

CREATE TABLE contract_templates (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    contract_type           contract_type NOT NULL,
    jurisdiction            VARCHAR(100) NOT NULL,             -- e.g. 'TN', 'MA', 'EU'
    version                 INTEGER NOT NULL,
    display_name            VARCHAR(255) NOT NULL,
    document_storage_key    TEXT NOT NULL,                     -- S3 reference to template
    status                  VARCHAR(50) NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','active','superseded','retired')),
    effective_date          DATE NOT NULL,
    approved_by             UUID REFERENCES users(id),
    approved_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES users(id),

    CONSTRAINT contract_templates_unique_version
        UNIQUE (tenant_id, contract_type, jurisdiction, version)
);

COMMENT ON TABLE contract_templates IS
    'Jurisdiction-aware, versioned legal templates. Every generated contract references
     the template version active at the time of generation. Templates are never deleted.';

-- -----------------------------------------------------------------------------

CREATE TABLE contracts (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    contract_type               contract_type NOT NULL,
    template_version_id         UUID NOT NULL REFERENCES contract_templates(id),
    jurisdiction                VARCHAR(100) NOT NULL,
    -- Parties (flexible structure for different contract types)
    primary_party_type          VARCHAR(50) NOT NULL,          -- 'student','university','guarantor'
    primary_party_id            UUID NOT NULL,
    secondary_party_type        VARCHAR(50) NOT NULL DEFAULT 'forsa',
    secondary_party_id          UUID,                          -- tenant id for FORSA
    -- References
    application_id              UUID REFERENCES applications(id),
    financing_decision_id       UUID REFERENCES financing_decisions(id),
    execution_ledger_id         UUID REFERENCES execution_ledger(id),
    -- Document
    document_storage_key        TEXT,                          -- generated contract document
    document_hash               TEXT,                          -- SHA-256 of generated document
    -- Status
    current_status              contract_status NOT NULL DEFAULT 'draft',
    current_version             INTEGER NOT NULL DEFAULT 1,
    generated_at                TIMESTAMPTZ,
    generated_by                UUID REFERENCES users(id),
    -- Activation
    fully_signed_at             TIMESTAMPTZ,
    activated_at                TIMESTAMPTZ,
    expiration_date             DATE,
    termination_date            DATE,
    termination_reason          TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_application ON contracts(application_id);
CREATE INDEX idx_contracts_primary_party ON contracts(primary_party_type, primary_party_id);
CREATE INDEX idx_contracts_status ON contracts(tenant_id, current_status);

-- -----------------------------------------------------------------------------

CREATE TABLE contract_versions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id             UUID NOT NULL REFERENCES contracts(id),
    version_number          INTEGER NOT NULL,
    document_storage_key    TEXT NOT NULL,
    document_hash           TEXT NOT NULL,
    status                  contract_status NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES users(id),
    change_summary          TEXT,
    execution_ledger_id     UUID REFERENCES execution_ledger(id),

    CONSTRAINT contract_versions_unique UNIQUE (contract_id, version_number)
);

COMMENT ON TABLE contract_versions IS
    'Full version history of every contract. Amendments create new versions.
     Originals are preserved. No contract record is ever overwritten.';

-- -----------------------------------------------------------------------------

CREATE TABLE contract_signatures (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_version_id     UUID NOT NULL REFERENCES contract_versions(id),
    party_type              VARCHAR(50) NOT NULL,
    party_id                UUID NOT NULL,
    signed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signature_method        VARCHAR(50) NOT NULL
                                CHECK (signature_method IN (
                                    'electronic_otp','electronic_provider',
                                    'wet_scan','biometric','platform_internal'
                                )),
    signature_reference     TEXT,                              -- external provider reference
    ip_address              INET,
    device_fingerprint      TEXT,
    witness_user_id         UUID REFERENCES users(id)
    -- Immutable after creation
);

CREATE INDEX idx_signatures_contract ON contract_signatures(contract_version_id);
CREATE INDEX idx_signatures_party ON contract_signatures(party_type, party_id);

-- -----------------------------------------------------------------------------

CREATE TABLE contract_amendments (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id                 UUID NOT NULL REFERENCES contracts(id),
    from_version_id             UUID NOT NULL REFERENCES contract_versions(id),
    to_version_id               UUID NOT NULL REFERENCES contract_versions(id),
    amendment_type              VARCHAR(100) NOT NULL
                                    CHECK (amendment_type IN (
                                        'payment_restructure','level_change',
                                        'tuition_modification','guarantor_change',
                                        'exceptional_event','legal_correction','other'
                                    )),
    reason                      TEXT NOT NULL,
    approved_by                 UUID NOT NULL REFERENCES users(id),
    approved_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    execution_ledger_id         UUID NOT NULL REFERENCES execution_ledger(id)
);

-- =============================================================================
-- DOMAIN 11: PAYMENTS & FINANCIAL LEDGER
-- =============================================================================

CREATE TYPE installment_status AS ENUM (
    'pending',
    'due_soon',
    'due_today',
    'paid',
    'partial',
    'late',
    'default_risk',
    'defaulted',
    'settled',
    'waived',
    'restructured'
);

CREATE TYPE payment_status AS ENUM (
    'pending',
    'confirmed',
    'reversed',
    'failed',
    'refunded'
);

-- -----------------------------------------------------------------------------

CREATE TABLE payment_schedules (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    student_id              UUID NOT NULL REFERENCES students(id),
    application_id          UUID NOT NULL REFERENCES applications(id),
    financing_decision_id   UUID NOT NULL REFERENCES financing_decisions(id),
    contract_id             UUID REFERENCES contracts(id),
    -- Schedule definition
    total_amount            NUMERIC(15,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'TND',
    installment_count       INTEGER NOT NULL,
    first_due_date          DATE NOT NULL,
    payment_frequency       VARCHAR(50) NOT NULL DEFAULT 'monthly'
                                CHECK (payment_frequency IN ('weekly','biweekly','monthly','quarterly')),
    payment_model           payment_model_type NOT NULL,
    -- Status
    status                  VARCHAR(50) NOT NULL DEFAULT 'active'
                                CHECK (status IN (
                                    'active','completed','suspended',
                                    'restructured','cancelled','defaulted'
                                )),
    -- Execution reference
    execution_ledger_id     UUID NOT NULL REFERENCES execution_ledger(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_schedules_student ON payment_schedules(student_id, status);

COMMENT ON TABLE payment_schedules IS
    'Created ONLY by the Decision Execution Engine. Never created directly by application code.';

-- -----------------------------------------------------------------------------

CREATE TABLE installments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_schedule_id UUID NOT NULL REFERENCES payment_schedules(id),
    student_id          UUID NOT NULL REFERENCES students(id),
    sequence_number     INTEGER NOT NULL,
    due_date            DATE NOT NULL,
    amount              NUMERIC(15,2) NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'TND',
    status              installment_status NOT NULL DEFAULT 'pending',
    paid_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
    remaining_balance   NUMERIC(15,2),
    penalty_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
    penalty_reason      TEXT,
    days_overdue        INTEGER,
    last_status_update  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT installments_unique_sequence
        UNIQUE (payment_schedule_id, sequence_number)
);

CREATE INDEX idx_installments_due ON installments(due_date, status);
CREATE INDEX idx_installments_student ON installments(student_id, status);

-- -----------------------------------------------------------------------------

CREATE TABLE payments (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    installment_id          UUID NOT NULL REFERENCES installments(id),
    student_id              UUID NOT NULL REFERENCES students(id),
    amount                  NUMERIC(15,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'TND',
    paid_at                 TIMESTAMPTZ NOT NULL,
    payment_method          VARCHAR(100) NOT NULL
                                CHECK (payment_method IN (
                                    'bank_transfer','cash','check',
                                    'card','mobile_payment','direct_debit','other'
                                )),
    receipt_reference       TEXT,
    receipt_storage_key     TEXT,                              -- S3 reference to receipt document
    status                  payment_status NOT NULL DEFAULT 'pending',
    source_trust_level      source_trust_level NOT NULL,
    recorded_by             UUID REFERENCES users(id),         -- NULL if automated
    recorded_by_process     VARCHAR(100),
    external_reference      TEXT,                             -- bank/gateway reference
    notes                   TEXT,
    execution_ledger_id     UUID REFERENCES execution_ledger(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_installment ON payments(installment_id);
CREATE INDEX idx_payments_student ON payments(student_id, created_at DESC);
CREATE INDEX idx_payments_status ON payments(tenant_id, status);

-- -----------------------------------------------------------------------------

CREATE TABLE payment_reversals (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_payment_id     UUID NOT NULL REFERENCES payments(id),
    reversal_reason         VARCHAR(100) NOT NULL
                                CHECK (reversal_reason IN (
                                    'bank_return','insufficient_funds','fraud',
                                    'duplicate','data_error','student_request','other'
                                )),
    reversal_reason_detail  TEXT,
    reversed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reversed_by             UUID REFERENCES users(id),
    reversed_by_process     VARCHAR(100),
    execution_ledger_id     UUID NOT NULL REFERENCES execution_ledger(id)
);

-- -----------------------------------------------------------------------------

CREATE TABLE university_disbursements (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    university_id           UUID NOT NULL REFERENCES universities(id),
    agreement_version_id    UUID NOT NULL REFERENCES university_agreements(id),
    application_id          UUID NOT NULL REFERENCES applications(id),
    student_id              UUID NOT NULL REFERENCES students(id),
    -- Disbursement definition
    amount                  NUMERIC(15,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'TND',
    disbursement_model      payment_model_type NOT NULL,
    tranche_sequence        INTEGER,
    tranche_id              UUID REFERENCES agreement_tranches(id),
    -- Status
    status                  VARCHAR(50) NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                    'pending','approved','processing',
                                    'disbursed','failed','reversed','reconciled'
                                )),
    disbursed_at            TIMESTAMPTZ,
    approved_by             UUID REFERENCES users(id),
    approved_at             TIMESTAMPTZ,
    payment_reference       TEXT,                              -- bank transfer reference
    execution_ledger_id     UUID NOT NULL REFERENCES execution_ledger(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disbursements_university ON university_disbursements(university_id, status);
CREATE INDEX idx_disbursements_application ON university_disbursements(application_id);

-- -----------------------------------------------------------------------------

CREATE TABLE unrecovered_disbursements (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    student_id              UUID NOT NULL REFERENCES students(id),
    application_id          UUID NOT NULL REFERENCES applications(id),
    disbursement_id         UUID NOT NULL REFERENCES university_disbursements(id),
    original_amount         NUMERIC(15,2) NOT NULL,
    recovered_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
    outstanding_amount      NUMERIC(15,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'TND',
    status                  VARCHAR(50) NOT NULL DEFAULT 'outstanding'
                                CHECK (status IN (
                                    'outstanding','partially_recovered',
                                    'fully_recovered','written_off','restructured'
                                )),
    last_updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_execution_id       UUID REFERENCES execution_ledger(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_unrecovered_tenant ON unrecovered_disbursements(tenant_id, status);
CREATE INDEX idx_unrecovered_student ON unrecovered_disbursements(student_id);

COMMENT ON TABLE unrecovered_disbursements IS
    'Tracks FORSA''s live capital exposure. This is a primary KPI shown on
     CEO and Finance dashboards. Updated by DEE only.';

-- -----------------------------------------------------------------------------
-- FINANCIAL LEDGER (Double-Entry, Append-Only)
-- -----------------------------------------------------------------------------

CREATE TABLE financial_ledger (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    entry_type              VARCHAR(100) NOT NULL,             -- e.g. 'disbursement','payment','reversal','penalty'
    debit_account           VARCHAR(100) NOT NULL,             -- account code
    credit_account          VARCHAR(100) NOT NULL,             -- account code
    amount                  NUMERIC(15,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'TND',
    exchange_rate           NUMERIC(15,6) DEFAULT 1.0,         -- for future multi-currency
    reference_type          VARCHAR(100) NOT NULL,             -- what this entry relates to
    reference_id            UUID NOT NULL,
    description             TEXT,
    execution_ledger_id     UUID NOT NULL REFERENCES execution_ledger(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()

    -- Append-only: no UPDATE or DELETE
);

CREATE INDEX idx_ledger_tenant_date ON financial_ledger(tenant_id, created_at DESC);
CREATE INDEX idx_ledger_reference ON financial_ledger(reference_type, reference_id);
CREATE INDEX idx_ledger_accounts ON financial_ledger(debit_account, credit_account);

COMMENT ON TABLE financial_ledger IS
    'Double-entry, append-only financial ledger. Every financial event writes here atomically.
     No UPDATE or DELETE permissions at application role level.
     Partitioning by created_at recommended at scale.';

-- -----------------------------------------------------------------------------
-- COMMISSION TRACKING
-- -----------------------------------------------------------------------------

CREATE TYPE commission_status AS ENUM (
    'lead',
    'eligible',
    'approved',
    'university_paid',
    'payable',
    'paid',
    'clawback_initiated',
    'clawed_back',
    'cancelled'
);

CREATE TABLE partner_commissions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    partner_id              UUID NOT NULL REFERENCES partners(id),
    partner_agreement_id    UUID NOT NULL REFERENCES partner_agreements(id),
    application_id          UUID NOT NULL REFERENCES applications(id),
    student_id              UUID NOT NULL REFERENCES students(id),
    -- Commission calculation
    commission_basis        VARCHAR(100) NOT NULL
                                CHECK (commission_basis IN (
                                    'flat_fee','percentage_tuition',
                                    'percentage_financed','tiered'
                                )),
    gross_amount            NUMERIC(15,2) NOT NULL,
    forsa_share             NUMERIC(15,2) NOT NULL,
    partner_share           NUMERIC(15,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'TND',
    policy_version_id       UUID NOT NULL REFERENCES policy_versions(id),
    -- Status lifecycle
    status                  commission_status NOT NULL DEFAULT 'lead',
    -- Payment tracking
    approved_by             UUID REFERENCES users(id),
    approved_at             TIMESTAMPTZ,
    paid_at                 TIMESTAMPTZ,
    payment_reference       TEXT,
    -- Clawback
    clawback_reason         TEXT,
    clawback_execution_id   UUID REFERENCES execution_ledger(id),
    -- Audit
    execution_ledger_id     UUID REFERENCES execution_ledger(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commissions_partner ON partner_commissions(partner_id, status);
CREATE INDEX idx_commissions_application ON partner_commissions(application_id);
CREATE INDEX idx_commissions_payable
    ON partner_commissions(tenant_id, status)
    WHERE status IN ('payable','approved');
