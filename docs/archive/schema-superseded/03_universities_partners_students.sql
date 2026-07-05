-- =============================================================================
-- FORSA OS — PostgreSQL Database Schema
-- Domain 5: Universities & Programs
-- Domain 6: Partners & Referrals
-- Domain 7: Students & Guarantors
-- =============================================================================

-- =============================================================================
-- DOMAIN 5: UNIVERSITIES & PROGRAMS
-- =============================================================================

CREATE TYPE payment_model_type AS ENUM (
    'advance',
    'concurrent',
    'tranche',
    'hybrid'
);

CREATE TYPE university_status AS ENUM (
    'prospect',
    'contact',
    'negotiation',
    'active',
    'suspended',
    'terminated'
);

-- -----------------------------------------------------------------------------

CREATE TABLE universities (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    name                    VARCHAR(255) NOT NULL,
    short_name              VARCHAR(100),
    country_code            CHAR(2) NOT NULL,
    city                    VARCHAR(100),
    address                 TEXT,
    website                 VARCHAR(255),
    accreditation_status    VARCHAR(100),
    accreditation_body      VARCHAR(255),
    accreditation_verified_at DATE,
    status                  university_status NOT NULL DEFAULT 'prospect',
    risk_level              VARCHAR(50) DEFAULT 'standard'
                                CHECK (risk_level IN ('low','standard','elevated','high')),
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_universities_tenant ON universities(tenant_id);
CREATE INDEX idx_universities_status ON universities(tenant_id, status);

-- -----------------------------------------------------------------------------

CREATE TABLE university_contacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id   UUID NOT NULL REFERENCES universities(id),
    full_name       VARCHAR(255) NOT NULL,
    title           VARCHAR(100),
    role            VARCHAR(100),
    email           VARCHAR(255),
    phone           VARCHAR(50),
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    status          VARCHAR(50) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------

CREATE TABLE university_agreements (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    university_id           UUID NOT NULL REFERENCES universities(id),
    version                 INTEGER NOT NULL DEFAULT 1,
    payment_model           payment_model_type NOT NULL,
    refund_policy           JSONB NOT NULL,                    -- structured refund rules
    discount_percentage     NUMERIC(5,2),
    referral_commission     JSONB,                             -- structured commission rules
    financing_levels        TEXT[] NOT NULL,                   -- ['level1','level2','level3']
    max_financing_amount    NUMERIC(15,2),
    currency                CHAR(3) NOT NULL DEFAULT 'TND',
    effective_date          DATE NOT NULL,
    expiration_date         DATE,
    status                  VARCHAR(50) NOT NULL DEFAULT 'draft'
                                CHECK (status IN (
                                    'draft','pending_signature','active',
                                    'expired','terminated','suspended'
                                )),
    document_storage_key    TEXT,                              -- S3 reference to signed agreement
    signed_at               TIMESTAMPTZ,
    signed_by_forsa         UUID REFERENCES users(id),
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_agreements_university ON university_agreements(university_id);
CREATE INDEX idx_agreements_active
    ON university_agreements(university_id, status)
    WHERE status = 'active';

COMMENT ON TABLE university_agreements IS
    'Versioned commercial agreements. Agreements are never overwritten.
     The version active at application time is pinned to the financing decision.';

-- -----------------------------------------------------------------------------

CREATE TABLE agreement_tranches (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agreement_id        UUID NOT NULL REFERENCES university_agreements(id),
    tranche_sequence    INTEGER NOT NULL,
    percentage          NUMERIC(5,2) NOT NULL,                 -- e.g. 50.00
    trigger_type        VARCHAR(100) NOT NULL
                            CHECK (trigger_type IN (
                                'enrollment','semester_start','milestone',
                                'date','payment_count'
                            )),
    trigger_condition   JSONB,                                 -- structured trigger definition
    due_days_offset     INTEGER,                               -- days after trigger
    notes               TEXT,

    CONSTRAINT agreement_tranches_unique_sequence
        UNIQUE (agreement_id, tranche_sequence)
);

COMMENT ON TABLE agreement_tranches IS
    'Defines payment tranches for tranche-based and hybrid payment models.';

-- -----------------------------------------------------------------------------

CREATE TABLE programs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id       UUID NOT NULL REFERENCES universities(id),
    name                VARCHAR(255) NOT NULL,
    code                VARCHAR(100),
    level               VARCHAR(100)
                            CHECK (level IN (
                                'preparatory','bachelor','master',
                                'doctorate','vocational','certificate','other'
                            )),
    duration_years      NUMERIC(3,1),
    tuition_min         NUMERIC(15,2),
    tuition_max         NUMERIC(15,2),
    currency            CHAR(3) NOT NULL DEFAULT 'TND',
    accreditation_status VARCHAR(100),
    status              VARCHAR(50) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','suspended','discontinued')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_programs_university ON programs(university_id, status);

-- -----------------------------------------------------------------------------

CREATE TABLE program_eligibility (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agreement_id    UUID NOT NULL REFERENCES university_agreements(id),
    program_id      UUID NOT NULL REFERENCES programs(id),
    financing_levels TEXT[] NOT NULL,
    max_amount      NUMERIC(15,2),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT program_eligibility_unique UNIQUE (agreement_id, program_id)
);

-- =============================================================================
-- DOMAIN 6: PARTNERS & REFERRALS
-- =============================================================================

CREATE TYPE partner_type AS ENUM (
    'platform',         -- Lycena, Wajahni
    'ambassador',
    'university',
    'agency',
    'event',
    'direct',
    'other'
);

CREATE TABLE partners (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    name            VARCHAR(255) NOT NULL,
    type            partner_type NOT NULL,
    website         VARCHAR(255),
    country_code    CHAR(2),
    status          VARCHAR(50) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','inactive','terminated')),
    fraud_risk_flag BOOLEAN NOT NULL DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_partners_tenant ON partners(tenant_id, status);

-- -----------------------------------------------------------------------------

CREATE TABLE partner_contacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id      UUID NOT NULL REFERENCES partners(id),
    full_name       VARCHAR(255) NOT NULL,
    role            VARCHAR(100),
    email           VARCHAR(255),
    phone           VARCHAR(50),
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    status          VARCHAR(50) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------

CREATE TABLE partner_agreements (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    partner_id                  UUID NOT NULL REFERENCES partners(id),
    version                     INTEGER NOT NULL DEFAULT 1,
    commission_structure        JSONB NOT NULL,                -- structured commission rules
    payment_conditions          JSONB NOT NULL,
    max_visible_information     JSONB NOT NULL,                -- permission ceiling definition
    allowed_reports             TEXT[],
    data_sharing_permissions    JSONB NOT NULL,
    confidentiality_terms       TEXT,
    fraud_prevention_terms      TEXT,
    termination_conditions      TEXT,
    audit_rights                BOOLEAN NOT NULL DEFAULT FALSE,
    effective_date              DATE NOT NULL,
    expiration_date             DATE,
    status                      VARCHAR(50) NOT NULL DEFAULT 'draft'
                                    CHECK (status IN (
                                        'draft','active','expired','terminated','suspended'
                                    )),
    document_storage_key        TEXT,
    signed_at                   TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by                  UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_partner_agreements_active
    ON partner_agreements(partner_id, status)
    WHERE status = 'active';

COMMENT ON TABLE partner_agreements IS
    'Versioned partnership agreements. Permission ceiling is defined here and cannot be exceeded
     by administrative configuration — only reduced.';

-- -----------------------------------------------------------------------------

CREATE TABLE referral_sources (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    code            VARCHAR(100) NOT NULL,                     -- controlled vocabulary code
    display_name    VARCHAR(255) NOT NULL,
    channel         VARCHAR(100),                             -- 'social','direct','platform','event'
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT referral_sources_unique_code UNIQUE (tenant_id, code)
);

-- -----------------------------------------------------------------------------

CREATE TABLE campaigns (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    partner_id          UUID REFERENCES partners(id),
    referral_source_id  UUID NOT NULL REFERENCES referral_sources(id),
    name                VARCHAR(255) NOT NULL,
    tracking_code       VARCHAR(100) UNIQUE,
    start_date          DATE,
    end_date            DATE,
    status              VARCHAR(50) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','paused','ended')),
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- DOMAIN 7: STUDENTS & GUARANTORS
-- =============================================================================

CREATE TYPE source_trust_level AS ENUM (
    'system_verified',      -- Level A: bank reconciliation, payment gateway
    'staff_verified',       -- Level B: FORSA employee action
    'partner_reported',     -- Level C: university or referral partner
    'student_reported'      -- Level D: self-submitted, requires verification
);

-- -----------------------------------------------------------------------------

CREATE TABLE students (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    -- Personal information
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    date_of_birth           DATE,
    gender                  VARCHAR(20),
    nationality             CHAR(2),                           -- ISO 3166-1
    national_id_reference   TEXT,                              -- encrypted reference, not raw value
    -- Contact
    email                   VARCHAR(255),
    phone_primary           VARCHAR(50),
    phone_secondary         VARCHAR(50),
    city                    VARCHAR(100),
    address                 TEXT,
    -- Status
    status                  VARCHAR(100) NOT NULL DEFAULT 'lead'
                                CHECK (status IN (
                                    'lead','active','completed',
                                    'withdrawn','defaulted','deceased','suspended'
                                )),
    -- Tracking
    created_from_application_id UUID,                         -- FK added after applications table
    assigned_to_user_id     UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_students_tenant ON students(tenant_id);
CREATE INDEX idx_students_status ON students(tenant_id, status);
CREATE INDEX idx_students_email ON students(email);

-- -----------------------------------------------------------------------------

CREATE TABLE student_profiles (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id                  UUID NOT NULL UNIQUE REFERENCES students(id),
    academic_level              VARCHAR(100),
    current_institution         VARCHAR(255),
    graduation_year             INTEGER,
    communication_reliability   VARCHAR(50) DEFAULT 'unknown'
                                    CHECK (communication_reliability IN (
                                        'unknown','poor','average','good','excellent'
                                    )),
    contact_reliability         VARCHAR(50) DEFAULT 'unknown'
                                    CHECK (contact_reliability IN (
                                        'unknown','poor','average','good','excellent'
                                    )),
    preferred_language          VARCHAR(10),
    notes                       TEXT,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by                  UUID REFERENCES users(id)
);

-- -----------------------------------------------------------------------------

CREATE TABLE guarantors (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    date_of_birth           DATE,
    national_id_reference   TEXT,                              -- encrypted reference
    relationship_to_student VARCHAR(100),
    employment_status       VARCHAR(100)
                                CHECK (employment_status IN (
                                    'employed','self_employed','retired',
                                    'unemployed','other','unknown'
                                )),
    employer_name           VARCHAR(255),
    income_stability        VARCHAR(50) DEFAULT 'unknown'
                                CHECK (income_stability IN (
                                    'unknown','low','medium','high','very_high'
                                )),
    email                   VARCHAR(255),
    phone_primary           VARCHAR(50),
    contact_reliability     VARCHAR(50) DEFAULT 'unknown'
                                CHECK (contact_reliability IN (
                                    'unknown','poor','average','good','excellent'
                                )),
    risk_level              VARCHAR(50) DEFAULT 'unknown'
                                CHECK (risk_level IN (
                                    'unknown','low','medium','high','very_high'
                                )),
    document_status         VARCHAR(50) DEFAULT 'pending'
                                CHECK (document_status IN (
                                    'pending','incomplete','complete','verified','rejected'
                                )),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID NOT NULL REFERENCES users(id)
);

-- -----------------------------------------------------------------------------

CREATE TABLE student_guarantors (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id          UUID NOT NULL REFERENCES students(id),
    guarantor_id        UUID NOT NULL REFERENCES guarantors(id),
    role                VARCHAR(50) NOT NULL DEFAULT 'primary'
                            CHECK (role IN ('primary','secondary')),
    status              VARCHAR(50) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','withdrawn','rejected','replaced')),
    effective_date      DATE NOT NULL,
    withdrawal_date     DATE,
    withdrawal_reason   VARCHAR(255),
    withdrawal_reason_code VARCHAR(100),                       -- controlled vocabulary
    added_by            UUID NOT NULL REFERENCES users(id),
    added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Guarantor withdrawal creates a new record with withdrawal_date set
    -- The original record is never updated
    CONSTRAINT student_guarantors_unique_active
        UNIQUE (student_id, guarantor_id, effective_date)
);

CREATE INDEX idx_student_guarantors_student ON student_guarantors(student_id, status);

COMMENT ON TABLE student_guarantors IS
    'Guarantor withdrawal creates a new record with status=withdrawn and withdrawal_date set.
     The original active record status is updated to withdrawn via Decision Execution Engine only.
     Full history is preserved.';

-- -----------------------------------------------------------------------------

CREATE TABLE student_exceptional_events (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    student_id                  UUID NOT NULL REFERENCES students(id),
    event_type                  VARCHAR(100) NOT NULL
                                    CHECK (event_type IN (
                                        'voluntary_withdrawal',
                                        'academic_dismissal',
                                        'medical_withdrawal',
                                        'transfer',
                                        'visa_administrative',
                                        'force_majeure',
                                        'university_closure',
                                        'program_cancellation',
                                        'tuition_modification',
                                        'accreditation_loss',
                                        'student_death',
                                        'student_incapacitation',
                                        'guarantor_withdrawal',
                                        'contract_breach',
                                        'other'
                                    )),
    event_reason_code           VARCHAR(100),                  -- controlled vocabulary
    description                 TEXT,
    affects_financial_obligations BOOLEAN NOT NULL DEFAULT FALSE,
    affects_contract            BOOLEAN NOT NULL DEFAULT FALSE,
    opened_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opened_by                   UUID NOT NULL REFERENCES users(id),
    status                      VARCHAR(50) NOT NULL DEFAULT 'open'
                                    CHECK (status IN (
                                        'open','under_review','resolved',
                                        'escalated','closed_no_action'
                                    )),
    required_reviewers          JSONB,                         -- role list from Event Classification Matrix
    allowed_resolutions         JSONB,                         -- permitted resolution options
    resolved_at                 TIMESTAMPTZ,
    resolution_type             VARCHAR(100),
    resolution_notes            TEXT,
    execution_ledger_id         UUID,                          -- set when DEE executes the resolution
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exceptional_events_student ON student_exceptional_events(student_id);
CREATE INDEX idx_exceptional_events_open
    ON student_exceptional_events(tenant_id, status)
    WHERE status IN ('open','under_review','escalated');
