export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DEACTIVATED = 'deactivated',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

export enum ApplicationStatus {
  NEW_LEAD = 'new_lead',
  APPLIED = 'applied',
  AI_INTERVIEW_COMPLETED = 'ai_interview_completed',
  INTERNAL_REVIEW = 'internal_review',
  PRE_APPROVED = 'pre_approved',
  DOCUMENT_VERIFICATION = 'document_verification',
  CONTRACTS_SIGNED = 'contracts_signed',
  UNIVERSITY_PAYMENT = 'university_payment',
  CONTACTED = 'contacted',
  WAITING_FOR_DOCUMENTS = 'waiting_for_documents',
  DOCUMENTS_RECEIVED = 'documents_received',
  UNDER_REVIEW = 'under_review',
  APPROVED_LEVEL1 = 'approved_level1',
  APPROVED_LEVEL2 = 'approved_level2',
  APPROVED_LEVEL3 = 'approved_level3',
  REJECTED = 'rejected',
  ON_HOLD = 'on_hold',
  CAPITAL_QUEUE = 'capital_queue',
  CONTRACT_SENT = 'contract_sent',
  CONTRACT_SIGNED = 'contract_signed',
  UNIVERSITY_PAID = 'university_paid',
  ACTIVE_STUDENT = 'active_student',
  COMPLETED = 'completed',
  WITHDRAWN = 'withdrawn',
  APPEALING = 'appealing',
}

export enum FinancingLevel {
  LEVEL1 = 'level1',
  LEVEL2 = 'level2',
  LEVEL3 = 'level3',
}

export enum DecisionResult {
  APPROVED_LEVEL1 = 'approved_level1',
  APPROVED_LEVEL2 = 'approved_level2',
  APPROVED_LEVEL3 = 'approved_level3',
  REJECTED = 'rejected',
  ON_HOLD = 'on_hold',
  NEEDS_MORE_DOCUMENTS = 'needs_more_documents',
  NEEDS_MANUAL_REVIEW = 'needs_manual_review',
  NEEDS_GUARANTOR_REVIEW = 'needs_guarantor_review',
  NEEDS_UNIVERSITY_CONFIRMATION = 'needs_university_confirmation',
  CAPITAL_QUEUE = 'capital_queue',
}

export enum PaymentModelType {
  ADVANCE = 'advance',
  CONCURRENT = 'concurrent',
  TRANCHE = 'tranche',
  HYBRID = 'hybrid',
}

export enum InstallmentStatus {
  PENDING = 'pending',
  DUE_SOON = 'due_soon',
  DUE_TODAY = 'due_today',
  PAID = 'paid',
  PARTIAL = 'partial',
  LATE = 'late',
  DEFAULT_RISK = 'default_risk',
  DEFAULTED = 'defaulted',
  SETTLED = 'settled',
  WAIVED = 'waived',
  RESTRUCTURED = 'restructured',
}

export enum PaymentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REVERSED = 'reversed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum ScoreDimension {
  PAYMENT_RELIABILITY = 'payment_reliability',
  DOCUMENTATION_RELIABILITY = 'documentation_reliability',
  COMMUNICATION_RELIABILITY = 'communication_reliability',
  ACADEMIC_CONTINUITY = 'academic_continuity',
  GUARANTOR_RELIABILITY = 'guarantor_reliability',
}

export enum ScoreSeverity {
  STANDARD = 'standard',
  ELEVATED = 'elevated',
  SEVERE = 'severe',
}

export enum ScoreBand {
  HIGH_RISK = 'high_risk',
  MEDIUM_TRUST = 'medium_trust',
  GOOD_TRUST = 'good_trust',
  VERY_GOOD_TRUST = 'very_good_trust',
  ELITE_TRUST = 'elite_trust',
}

export enum SourceTrustLevel {
  SYSTEM_VERIFIED = 'system_verified',
  STAFF_VERIFIED = 'staff_verified',
  PARTNER_REPORTED = 'partner_reported',
  STUDENT_REPORTED = 'student_reported',
}

export enum DocumentStatus {
  ABSENT = 'absent',
  UPLOADED = 'uploaded',
  UNDER_REVIEW = 'under_review',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  SUPERSEDED = 'superseded',
}

export enum ContractType {
  STUDENT_FORSA = 'student_forsa',
  FORSA_UNIVERSITY = 'forsa_university',
  STUDENT_UNIVERSITY = 'student_university',
  GUARANTOR_FORSA = 'guarantor_forsa',
}

export enum ContractStatus {
  DRAFT = 'draft',
  SENT_FOR_SIGNATURE = 'sent_for_signature',
  PARTIALLY_SIGNED = 'partially_signed',
  FULLY_SIGNED = 'fully_signed',
  ACTIVE = 'active',
  AMENDED = 'amended',
  TERMINATED = 'terminated',
  EXPIRED = 'expired',
  VOIDED = 'voided',
}

export enum ExecutionStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMMITTED = 'committed',
  ROLLED_BACK = 'rolled_back',
  FAILED = 'failed',
  DUPLICATE_REJECTED = 'duplicate_rejected',
}

export enum PolicyScopeType {
  GLOBAL = 'global',
  COUNTRY = 'country',
  UNIVERSITY = 'university',
  PARTNER = 'partner',
  STUDENT = 'student',
  PROGRAM = 'program',
}

export enum PolicyStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  ACTIVE = 'active',
  SUPERSEDED = 'superseded',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export enum UniversityStatus {
  PROSPECT = 'prospect',
  CONTACT = 'contact',
  NEGOTIATION = 'negotiation',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

export enum PartnerType {
  PLATFORM = 'platform',
  AMBASSADOR = 'ambassador',
  UNIVERSITY = 'university',
  AGENCY = 'agency',
  EVENT = 'event',
  DIRECT = 'direct',
  OTHER = 'other',
}

export enum CommissionStatus {
  LEAD = 'lead',
  ELIGIBLE = 'eligible',
  APPROVED = 'approved',
  UNIVERSITY_PAID = 'university_paid',
  PAYABLE = 'payable',
  PAID = 'paid',
  CLAWBACK_INITIATED = 'clawback_initiated',
  CLAWED_BACK = 'clawed_back',
  CANCELLED = 'cancelled',
}

export enum ExceptionalEventType {
  VOLUNTARY_WITHDRAWAL = 'voluntary_withdrawal',
  ACADEMIC_DISMISSAL = 'academic_dismissal',
  MEDICAL_WITHDRAWAL = 'medical_withdrawal',
  TRANSFER = 'transfer',
  VISA_ADMINISTRATIVE = 'visa_administrative',
  FORCE_MAJEURE = 'force_majeure',
  UNIVERSITY_CLOSURE = 'university_closure',
  PROGRAM_CANCELLATION = 'program_cancellation',
  TUITION_MODIFICATION = 'tuition_modification',
  ACCREDITATION_LOSS = 'accreditation_loss',
  STUDENT_DEATH = 'student_death',
  STUDENT_INCAPACITATION = 'student_incapacitation',
  GUARANTOR_WITHDRAWAL = 'guarantor_withdrawal',
  CONTRACT_BREACH = 'contract_breach',
  OTHER = 'other',
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  IN_APP = 'in_app',
  PUSH = 'push',
}

export enum MfaMethod {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email',
}

export enum PipelineRunStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  SUPERSEDED = 'superseded',
}

export enum ApprovalSequencing {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  HYBRID = 'hybrid',
}

export enum SecurityEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGIN_BLOCKED = 'login_blocked',
  MFA_SUCCESS = 'mfa_success',
  MFA_FAILURE = 'mfa_failure',
  PASSWORD_CHANGED = 'password_changed',
  SESSION_INVALIDATED = 'session_invalidated',
  PERMISSION_DENIED = 'permission_denied',
  RATE_LIMIT_TRIGGERED = 'rate_limit_triggered',
  SUSPICIOUS_REQUEST = 'suspicious_request',
  TOKEN_REUSE_ATTEMPT = 'token_reuse_attempt',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  ROLE_ELEVATED = 'role_elevated',
  ADMIN_ACTION = 'admin_action',
  IMMUTABILITY_VIOLATION_ATTEMPT = 'immutability_violation_attempt',
}

export enum StudentStatus {
  LEAD = 'lead',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  WITHDRAWN = 'withdrawn',
  DEFAULTED = 'defaulted',
  DECEASED = 'deceased',
  SUSPENDED = 'suspended',
}

// Phase 2 — D-004: coarse, long-lived membership tier, distinct from
// ApplicationStatus (fine-grained, per financing request). Pure ratchet
// upward except the fraud/blacklist path — nothing ever moves a student
// back down from silver/gold to bronze automatically.
export enum MembershipStatus {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  BLACKLISTED = 'blacklisted',
}

export enum MembershipRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}
