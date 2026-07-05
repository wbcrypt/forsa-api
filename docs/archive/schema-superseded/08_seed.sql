-- =============================================================================
-- FORSA OS — Seed Data
-- File: 08_seed.sql
-- =============================================================================
-- Seeds system roles, permissions, referral sources, document types,
-- and policy DEFINITIONS (not values — values are set by administrators).
--
-- NO commercial values are hardcoded here:
--   - Commission percentages → configured by Finance in Policy Engine
--   - Fee amounts           → configured by Finance in Policy Engine
--   - Score event points    → configured by Finance/Risk in Policy Engine
--   - Approval thresholds   → configured by CEO/Finance in Policy Engine
--   - Rate limits           → configured in application environment
--
-- This file is safe to run in any environment.
-- =============================================================================

-- Temporary reference UUID for system bootstrap
-- In production, replace with real admin user UUID after first user is created
DO $$
DECLARE
    system_tenant_id    UUID;
    system_user_id      UUID := '00000000-0000-0000-0000-000000000001'; -- bootstrap placeholder
BEGIN

-- =============================================================================
-- SYSTEM ROLES
-- =============================================================================

INSERT INTO roles (tenant_id, name, description, is_system_role, status)
SELECT
    t.id,
    r.name,
    r.description,
    TRUE,
    'active'
FROM tenants t
CROSS JOIN (VALUES
    ('ceo',             'Chief Executive Officer — full read access, executive approvals'),
    ('finance',         'Finance team — payment management, disbursements, financial reports'),
    ('collections',     'Collections team — payment follow-up, installment management'),
    ('sales',           'Sales & Partnerships — university and partner management'),
    ('marketing',       'Marketing — campaign management, referral source tracking'),
    ('legal',           'Legal team — contract review, legal approvals, compliance'),
    ('read_only_investor', 'Read-only investor access — aggregated financial data only'),
    ('admin',           'System administrator — user and role management')
) AS r(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- PERMISSIONS — Granular permission codes
-- =============================================================================

INSERT INTO permissions (code, description, module, action, is_high_impact)
VALUES
    -- Student module
    ('student.view',                'View student records',                  'student',      'view',     FALSE),
    ('student.create',              'Create new student records',            'student',      'create',   FALSE),
    ('student.edit',                'Edit student profile information',      'student',      'edit',     FALSE),
    ('student.view_pii',            'View student PII (ID, address)',        'student',      'view_pii', TRUE),
    ('student.export',              'Export student data',                   'student',      'export',   TRUE),

    -- Application module
    ('application.view',            'View applications',                     'application',  'view',     FALSE),
    ('application.create',          'Create applications',                   'application',  'create',   FALSE),
    ('application.edit',            'Edit application data',                 'application',  'edit',     FALSE),
    ('application.submit_pipeline', 'Submit application to pipeline',        'application',  'submit',   FALSE),

    -- Financing decisions
    ('financing.view',              'View financing decisions',              'financing',    'view',     FALSE),
    ('financing.approve_level1',    'Approve Level 1 financing',             'financing',    'approve',  TRUE),
    ('financing.approve_level2',    'Approve Level 2 financing',             'financing',    'approve',  TRUE),
    ('financing.approve_level3',    'Approve Level 3 referral',              'financing',    'approve',  FALSE),
    ('financing.reject',            'Reject financing applications',         'financing',    'reject',   TRUE),
    ('financing.override',          'Manual override financing decisions',   'financing',    'override', TRUE),
    ('financing.ceo_approve',       'CEO-level financing approval',          'financing',    'ceo',      TRUE),

    -- Payments
    ('payment.view',                'View payment records',                  'payment',      'view',     FALSE),
    ('payment.record',              'Record manual payments',                'payment',      'record',   TRUE),
    ('payment.waive_penalty',       'Waive installment penalties',           'payment',      'waive',    TRUE),
    ('payment.restructure',         'Restructure payment schedules',         'payment',      'restructure', TRUE),
    ('payment.write_off',           'Write off outstanding balances',        'payment',      'write_off', TRUE),
    ('payment.approve_disbursement','Approve university disbursements',      'payment',      'disburse', TRUE),

    -- Collections
    ('collections.view',            'View collections dashboard',            'collections',  'view',     FALSE),
    ('collections.assign',          'Assign collection cases',               'collections',  'assign',   FALSE),
    ('collections.escalate',        'Escalate collection cases',             'collections',  'escalate', TRUE),
    ('collections.note',            'Add collection notes',                  'collections',  'note',     FALSE),

    -- FORSA Score
    ('score.view',                  'View FORSA Score',                      'score',        'view',     FALSE),
    ('score.view_history',          'View full score history',               'score',        'history',  FALSE),
    ('score.adjust',                'Request manual score adjustment',       'score',        'adjust',   TRUE),
    ('score.approve_adjustment',    'Approve manual score adjustment',       'score',        'approve',  TRUE),

    -- Contracts
    ('contract.view',               'View contracts',                        'contract',     'view',     FALSE),
    ('contract.generate',           'Generate contracts',                    'contract',     'generate', FALSE),
    ('contract.sign_forsa',         'Sign contracts on behalf of FORSA',     'contract',     'sign',     TRUE),
    ('contract.amend',              'Initiate contract amendments',          'contract',     'amend',    TRUE),
    ('contract.approve_amendment',  'Approve contract amendments',           'contract',     'approve',  TRUE),

    -- Universities
    ('university.view',             'View university records',               'university',   'view',     FALSE),
    ('university.create',           'Create university records',             'university',   'create',   FALSE),
    ('university.edit',             'Edit university information',           'university',   'edit',     FALSE),
    ('university.agreement.create', 'Create university agreements',          'university',   'agreement',TRUE),
    ('university.agreement.approve','Approve university agreements',         'university',   'approve',  TRUE),

    -- Partners
    ('partner.view',                'View partner records',                  'partner',      'view',     FALSE),
    ('partner.create',              'Create partner records',                'partner',      'create',   FALSE),
    ('partner.edit',                'Edit partner information',              'partner',      'edit',     FALSE),
    ('partner.commission.approve',  'Approve partner commissions',           'partner',      'approve',  TRUE),

    -- Documents
    ('document.view',               'View document metadata',                'document',     'view',     FALSE),
    ('document.download',           'Download documents',                    'document',     'download', TRUE),
    ('document.verify',             'Verify submitted documents',            'document',     'verify',   FALSE),
    ('document.reject',             'Reject submitted documents',            'document',     'reject',   FALSE),
    ('document.delete_metadata',    'Mark document as superseded',           'document',     'delete',   TRUE),

    -- Policy Engine
    ('policy.view',                 'View policies',                         'policy',       'view',     FALSE),
    ('policy.create',               'Create policy versions',                'policy',       'create',   TRUE),
    ('policy.approve',              'Approve policy changes',                'policy',       'approve',  TRUE),
    ('policy.audit',                'View full policy audit history',        'policy',       'audit',    FALSE),

    -- Reports & Analytics
    ('report.view_financial',       'View financial reports',                'report',       'financial',FALSE),
    ('report.view_risk',            'View risk reports',                     'report',       'risk',     FALSE),
    ('report.view_portfolio',       'View portfolio reports',                'report',       'portfolio',FALSE),
    ('report.export',               'Export reports',                        'report',       'export',   TRUE),
    ('report.investor_view',        'Access investor-level aggregated data', 'report',       'investor', FALSE),

    -- Audit
    ('audit.view',                  'View audit logs',                       'audit',        'view',     FALSE),
    ('audit.security_view',         'View security event logs',              'audit',        'security', TRUE),

    -- Users & Admin
    ('user.view',                   'View user accounts',                    'admin',        'view',     FALSE),
    ('user.create',                 'Create user accounts',                  'admin',        'create',   TRUE),
    ('user.edit',                   'Edit user accounts',                    'admin',        'edit',     TRUE),
    ('user.deactivate',             'Deactivate user accounts',              'admin',        'deactivate',TRUE),
    ('user.role.assign',            'Assign roles to users',                 'admin',        'role',     TRUE),
    ('user.session.revoke',         'Revoke active user sessions',           'admin',        'session',  TRUE),

    -- Exceptional Events
    ('exceptional_event.view',      'View exceptional events',               'exceptional',  'view',     FALSE),
    ('exceptional_event.open',      'Open exceptional event cases',          'exceptional',  'open',     FALSE),
    ('exceptional_event.resolve',   'Resolve exceptional event cases',       'exceptional',  'resolve',  TRUE),

    -- Execution Engine (restricted)
    ('execution.view_ledger',       'View execution ledger',                 'execution',    'view',     FALSE),
    ('execution.trigger',           'Trigger DEE execution (system only)',   'execution',    'trigger',  TRUE)

ON CONFLICT (code) DO NOTHING;


-- =============================================================================
-- REFERRAL SOURCES — Controlled Vocabulary
-- =============================================================================

INSERT INTO referral_sources (tenant_id, code, display_name, channel, is_active)
SELECT
    t.id,
    s.code,
    s.display_name,
    s.channel,
    TRUE
FROM tenants t
CROSS JOIN (VALUES
    ('website',         'FORSA Website',            'digital'),
    ('direct',          'Direct (Walk-in/Call)',     'direct'),
    ('facebook',        'Facebook',                 'social'),
    ('instagram',       'Instagram',                'social'),
    ('tiktok',          'TikTok',                   'social'),
    ('google',          'Google (SEO/SEM)',          'digital'),
    ('lycena',          'Lycena Platform',           'platform'),
    ('wajahni',         'Wajahni Platform',         'platform'),
    ('university',      'University Referral',       'partner'),
    ('ambassador',      'Student Ambassador',        'ambassador'),
    ('event',           'Event / Fair',             'event'),
    ('email_campaign',  'Email Campaign',            'digital'),
    ('sms_campaign',    'SMS Campaign',              'digital'),
    ('word_of_mouth',   'Word of Mouth',             'direct'),
    ('other',           'Other',                    'other')
) AS s(code, display_name, channel)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- DOCUMENT TYPES — Controlled Vocabulary
-- =============================================================================

INSERT INTO document_types (
    tenant_id, code, display_name, description,
    required_for_levels, required_for_stages, required_for_roles,
    tracks_expiry, expiry_warning_days, is_active
)
SELECT
    t.id,
    d.code,
    d.display_name,
    d.description,
    d.required_for_levels,
    d.required_for_stages,
    d.required_for_roles,
    d.tracks_expiry,
    d.expiry_warning_days,
    TRUE
FROM tenants t
CROSS JOIN (VALUES
    ('national_id',         'National Identity Card',       'Government-issued national ID',
        ARRAY['level1','level2','level3'], ARRAY['stage1'], ARRAY['student'],        TRUE,  30),
    ('passport',            'Passport',                     'Valid passport',
        ARRAY['level1','level2'], ARRAY['stage1'], ARRAY['student'],                TRUE,  60),
    ('enrollment_cert',     'Enrollment Certificate',       'University enrollment confirmation',
        ARRAY['level1','level2'], ARRAY['stage1','stage3'], ARRAY['student'],       TRUE,  30),
    ('income_proof',        'Income / Salary Proof',        'Proof of income or salary slip',
        ARRAY['level1','level2'], ARRAY['stage4'], ARRAY['guarantor'],              TRUE,  90),
    ('guarantor_id',        'Guarantor Identity Document',  'Guarantor national ID or passport',
        ARRAY['level1','level2'], ARRAY['stage4'], ARRAY['guarantor'],              TRUE,  30),
    ('guarantor_employment','Guarantor Employment Proof',   'Employment certificate or pay slip',
        ARRAY['level1'], ARRAY['stage4'], ARRAY['guarantor'],                       TRUE,  90),
    ('bank_statement',      'Bank Statement',               'Recent bank account statement',
        ARRAY['level1'], ARRAY['stage4'], ARRAY['student','guarantor'],             TRUE,  30),
    ('university_acceptance','University Acceptance Letter','Official admission letter',
        ARRAY['level1','level2','level3'], ARRAY['stage2'], ARRAY['student'],       FALSE, 0),
    ('tuition_invoice',     'Tuition Fee Invoice',          'Official tuition payment invoice',
        ARRAY['level1','level2'], ARRAY['stage3'], ARRAY['student'],                TRUE,  0),
    ('signed_contract',     'Signed Student Contract',      'FORSA-Student signed agreement',
        ARRAY['level1','level2','level3'], ARRAY['stage9'], ARRAY['student'],       FALSE, 0),
    ('signed_guarantor_contract','Signed Guarantor Contract','FORSA-Guarantor signed agreement',
        ARRAY['level1','level2'], ARRAY['stage9'], ARRAY['guarantor'],              FALSE, 0),
    ('payment_receipt',     'Payment Receipt',              'Proof of payment',
        NULL, NULL, ARRAY['student'],                                               FALSE, 0),
    ('medical_certificate', 'Medical Certificate',          'Medical documentation for exceptional events',
        NULL, NULL, ARRAY['student'],                                               TRUE,  365),
    ('other',               'Other Document',               'Miscellaneous supporting document',
        NULL, NULL, NULL,                                                           FALSE, 0)
) AS d(
    code, display_name, description,
    required_for_levels, required_for_stages, required_for_roles,
    tracks_expiry, expiry_warning_days
)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- POLICY DEFINITIONS — Structure only, NO values
-- Values are set by authorized Finance/Risk administrators through the Policy Engine UI
-- =============================================================================

INSERT INTO policy_definitions (
    tenant_id, policy_key, display_name, description,
    module, scope_type, value_type, is_system, created_by
)
SELECT
    t.id,
    p.policy_key,
    p.display_name,
    p.description,
    p.module,
    p.scope_type::policy_scope_type,
    p.value_type::policy_value_type,
    TRUE,
    system_user_id
FROM tenants t
CROSS JOIN (VALUES
    -- Score Engine Policies (no values — set by administrators)
    ('score.starting_score.first_time',         'Starting Score — First-Time Student',          'Default starting score for new students',                          'score',        'global',   'numeric'),
    ('score.starting_score.returning_positive',  'Starting Score — Returning Positive',          'Score carry-forward rules for returning students in good standing', 'score',        'global',   'json'),
    ('score.starting_score.returning_negative',  'Starting Score — Returning Negative Standing', 'Score treatment for returning students with negative history',      'score',        'global',   'json'),
    ('score.dimension.weights',                  'Score Dimension Weights',                      'Relative weights of each scoring dimension (must sum to 100)',     'score',        'global',   'json'),
    ('score.dimension.ceiling_rules',            'Dimension Ceiling Rules',                      'Which dimension failures impose score ceilings and their limits',   'score',        'global',   'json'),
    ('score.band.thresholds',                    'Score Band Thresholds',                        'Score ranges for each trust band',                                 'score',        'global',   'json'),
    ('score.decay.standard',                     'Decay — Standard Events',                      'Decay curve for standard severity events',                         'score',        'global',   'json'),
    ('score.decay.elevated',                     'Decay — Elevated Events',                      'Decay curve for elevated severity events',                         'score',        'global',   'json'),
    ('score.decay.severe',                       'Decay — Severe Events',                        'Decay curve and floor for severe events',                          'score',        'global',   'json'),
    ('score.reconciliation.max_interval_days',   'Reconciliation Max Interval',                  'Maximum days between score reconciliations per student',            'score',        'global',   'numeric'),
    ('score.reconciliation.sla_hours',           'Reconciliation Discrepancy SLA',               'Hours to investigate a reconciliation discrepancy',                'score',        'global',   'numeric'),
    ('score.dcs.mandatory_review_floor',         'DCS Mandatory Review Floor',                   'Minimum DCS threshold below which manual review is always required','score',        'global',   'numeric'),

    -- Financing Policies
    ('financing.level1.max_amount',              'Level 1 Maximum Financing Amount',             'Maximum single financing amount for Level 1',                      'financing',    'global',   'numeric'),
    ('financing.level2.max_amount',              'Level 2 Maximum Financing Amount',             'Maximum single financing amount for Level 2',                      'financing',    'global',   'numeric'),
    ('financing.portfolio.max_exposure',         'Maximum Portfolio Exposure',                   'Maximum total unrecovered disbursement allowed',                   'financing',    'global',   'numeric'),
    ('financing.university.max_allocation',      'Maximum University Allocation',                'Maximum capital deployed to any single university',                'financing',    'university','numeric'),
    ('financing.capital_queue.max_duration_days','Capital Queue Maximum Duration',               'Maximum days an application can remain in capital queue',          'financing',    'global',   'numeric'),

    -- Approval Thresholds (no commercial values hardcoded)
    ('approval.threshold.finance_review',        'Finance Review Threshold',                     'Financing amount above which Finance approval is required',         'approval',     'global',   'numeric'),
    ('approval.threshold.ceo_review',            'CEO Review Threshold',                         'Financing amount above which CEO approval is required',             'approval',     'global',   'numeric'),
    ('approval.threshold.dual_approval',         'Dual Approval Threshold',                      'Amount above which dual approval is required',                     'approval',     'global',   'numeric'),
    ('approval.threshold.write_off',             'Write-Off Approval Threshold',                 'Write-off amount above which Finance+Legal approval required',      'approval',     'global',   'numeric'),
    ('approval.threshold.commission_payment',    'Commission Payment Threshold',                  'Commission amount above which dual approval is required',          'approval',     'global',   'numeric'),

    -- Fee Policies (structure only — amounts set by administrators)
    ('fee.platform.structure',                   'Platform Fee Structure',                       'Platform/administrative fee rules and calculation method',          'fee',          'global',   'json'),
    ('fee.penalty.structure',                    'Penalty Fee Structure',                        'Late payment penalty rules and calculation method',                'fee',          'global',   'json'),
    ('fee.penalty.waiver_authority',             'Penalty Waiver Authority',                     'Which roles may waive penalties and under what conditions',         'fee',          'global',   'json'),

    -- Commission Policies (structure only — no hardcoded percentages)
    ('commission.structure.default',             'Default Commission Structure',                  'Default referral commission calculation rules',                    'commission',   'global',   'json'),
    ('commission.clawback.rules',                'Commission Clawback Rules',                    'Conditions under which commissions are clawed back',               'commission',   'global',   'json'),
    ('commission.payment.schedule',              'Commission Payment Schedule',                  'When and how partner commissions are paid',                        'commission',   'global',   'json'),

    -- Collections Policies
    ('collections.escalation.ladder',            'Collections Escalation Ladder',                'Step-by-step escalation rules based on days overdue',              'collections',  'global',   'json'),
    ('collections.legal.escalation_rules',       'Legal Escalation Rules',                       'Independent rules for legal action (NOT based on FORSA Score)',    'collections',  'global',   'json'),
    ('collections.score.prioritization_rules',   'Score-Based Prioritization Rules',             'How FORSA Score influences collections priority (not escalation)', 'collections',  'global',   'json'),

    -- Data Retention Policies
    ('retention.student_data_years',             'Student Data Retention Period',                'Years to retain student personal data after completion',            'compliance',   'global',   'numeric'),
    ('retention.audit_log_years',                'Audit Log Retention Period',                   'Years to retain audit logs (legal minimum)',                        'compliance',   'global',   'numeric'),
    ('retention.score_history_years',            'Score History Retention Period',               'Years to retain full score event history',                          'compliance',   'global',   'numeric'),

    -- Rate Limiting (structure only — values in application environment)
    ('security.rate_limit.login_attempts',       'Login Rate Limit',                             'Maximum login attempts per window before lockout',                  'security',     'global',   'json'),
    ('security.rate_limit.api_requests',         'API Rate Limit',                               'Maximum API requests per window per client',                        'security',     'global',   'json'),
    ('security.session.timeout_minutes',         'Session Timeout',                              'Inactive session timeout in minutes',                               'security',     'global',   'numeric'),
    ('security.password.complexity_rules',       'Password Complexity Rules',                    'Minimum password requirements',                                     'security',     'global',   'json')

) AS p(policy_key, display_name, description, module, scope_type, value_type)
ON CONFLICT DO NOTHING;

END $$;

-- =============================================================================
-- COMMENT: What is deliberately NOT seeded here
-- =============================================================================
-- The following are explicitly NOT hardcoded and must be configured by
-- authorized administrators through the Policy Engine after deployment:
--
--   - Score event point values (+/- points per event type)
--   - Commission percentages or flat fees
--   - Platform fee amounts or percentages
--   - Penalty calculation rates
--   - Financing level amount limits
--   - Approval threshold amounts
--   - Score band threshold values
--   - Decay curve parameters
--   - Session timeout values
--   - Rate limit window sizes
--
-- This ensures that no commercial, financial, or security-sensitive
-- configuration value is ever committed to version control.
-- =============================================================================
