"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipRequestStatus = exports.MembershipStatus = exports.StudentStatus = exports.SecurityEventType = exports.ApprovalSequencing = exports.PipelineRunStatus = exports.MfaMethod = exports.NotificationChannel = exports.ExceptionalEventType = exports.CommissionStatus = exports.PartnerType = exports.UniversityStatus = exports.PolicyStatus = exports.PolicyScopeType = exports.ExecutionStatus = exports.ContractStatus = exports.ContractType = exports.DocumentStatus = exports.SourceTrustLevel = exports.ScoreBand = exports.ScoreSeverity = exports.ScoreDimension = exports.PaymentStatus = exports.InstallmentStatus = exports.PaymentModelType = exports.DecisionResult = exports.FinancingLevel = exports.ApplicationStatus = exports.TenantStatus = exports.UserStatus = void 0;
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["SUSPENDED"] = "suspended";
    UserStatus["DEACTIVATED"] = "deactivated";
    UserStatus["PENDING_VERIFICATION"] = "pending_verification";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
var TenantStatus;
(function (TenantStatus) {
    TenantStatus["ACTIVE"] = "active";
    TenantStatus["SUSPENDED"] = "suspended";
    TenantStatus["INACTIVE"] = "inactive";
})(TenantStatus || (exports.TenantStatus = TenantStatus = {}));
var ApplicationStatus;
(function (ApplicationStatus) {
    ApplicationStatus["NEW_LEAD"] = "new_lead";
    ApplicationStatus["AI_INTERVIEW_COMPLETED"] = "ai_interview_completed";
    ApplicationStatus["CONTACTED"] = "contacted";
    ApplicationStatus["WAITING_FOR_DOCUMENTS"] = "waiting_for_documents";
    ApplicationStatus["DOCUMENTS_RECEIVED"] = "documents_received";
    ApplicationStatus["UNDER_REVIEW"] = "under_review";
    ApplicationStatus["MORE_INFO_REQUIRED"] = "more_info_required";
    ApplicationStatus["APPROVED_LEVEL1"] = "approved_level1";
    ApplicationStatus["APPROVED_LEVEL2"] = "approved_level2";
    ApplicationStatus["APPROVED_LEVEL3"] = "approved_level3";
    ApplicationStatus["REJECTED"] = "rejected";
    ApplicationStatus["ON_HOLD"] = "on_hold";
    ApplicationStatus["CAPITAL_QUEUE"] = "capital_queue";
    ApplicationStatus["FRAUD_FLAGGED"] = "fraud_flagged";
    ApplicationStatus["CONTRACT_SENT"] = "contract_sent";
    ApplicationStatus["CONTRACT_SIGNED"] = "contract_signed";
    ApplicationStatus["UNIVERSITY_CONFIRMED"] = "university_confirmed";
    ApplicationStatus["UNIVERSITY_PAID"] = "university_paid";
    ApplicationStatus["ACTIVE_STUDENT"] = "active_student";
    ApplicationStatus["COMPLETED"] = "completed";
    ApplicationStatus["WITHDRAWN"] = "withdrawn";
    ApplicationStatus["APPEALING"] = "appealing";
})(ApplicationStatus || (exports.ApplicationStatus = ApplicationStatus = {}));
var FinancingLevel;
(function (FinancingLevel) {
    FinancingLevel["LEVEL1"] = "level1";
    FinancingLevel["LEVEL2"] = "level2";
    FinancingLevel["LEVEL3"] = "level3";
})(FinancingLevel || (exports.FinancingLevel = FinancingLevel = {}));
var DecisionResult;
(function (DecisionResult) {
    DecisionResult["APPROVED_LEVEL1"] = "approved_level1";
    DecisionResult["APPROVED_LEVEL2"] = "approved_level2";
    DecisionResult["APPROVED_LEVEL3"] = "approved_level3";
    DecisionResult["REJECTED"] = "rejected";
    DecisionResult["ON_HOLD"] = "on_hold";
    DecisionResult["NEEDS_MORE_DOCUMENTS"] = "needs_more_documents";
    DecisionResult["NEEDS_MANUAL_REVIEW"] = "needs_manual_review";
    DecisionResult["NEEDS_GUARANTOR_REVIEW"] = "needs_guarantor_review";
    DecisionResult["NEEDS_UNIVERSITY_CONFIRMATION"] = "needs_university_confirmation";
    DecisionResult["CAPITAL_QUEUE"] = "capital_queue";
    DecisionResult["FRAUD"] = "fraud";
})(DecisionResult || (exports.DecisionResult = DecisionResult = {}));
var PaymentModelType;
(function (PaymentModelType) {
    PaymentModelType["ADVANCE"] = "advance";
    PaymentModelType["CONCURRENT"] = "concurrent";
    PaymentModelType["TRANCHE"] = "tranche";
    PaymentModelType["HYBRID"] = "hybrid";
})(PaymentModelType || (exports.PaymentModelType = PaymentModelType = {}));
var InstallmentStatus;
(function (InstallmentStatus) {
    InstallmentStatus["PENDING"] = "pending";
    InstallmentStatus["DUE_SOON"] = "due_soon";
    InstallmentStatus["DUE_TODAY"] = "due_today";
    InstallmentStatus["PAID"] = "paid";
    InstallmentStatus["PARTIAL"] = "partial";
    InstallmentStatus["LATE"] = "late";
    InstallmentStatus["DEFAULT_RISK"] = "default_risk";
    InstallmentStatus["DEFAULTED"] = "defaulted";
    InstallmentStatus["SETTLED"] = "settled";
    InstallmentStatus["WAIVED"] = "waived";
    InstallmentStatus["RESTRUCTURED"] = "restructured";
})(InstallmentStatus || (exports.InstallmentStatus = InstallmentStatus = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "pending";
    PaymentStatus["CONFIRMED"] = "confirmed";
    PaymentStatus["REVERSED"] = "reversed";
    PaymentStatus["FAILED"] = "failed";
    PaymentStatus["REFUNDED"] = "refunded";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var ScoreDimension;
(function (ScoreDimension) {
    ScoreDimension["PAYMENT_RELIABILITY"] = "payment_reliability";
    ScoreDimension["DOCUMENTATION_RELIABILITY"] = "documentation_reliability";
    ScoreDimension["COMMUNICATION_RELIABILITY"] = "communication_reliability";
    ScoreDimension["ACADEMIC_CONTINUITY"] = "academic_continuity";
    ScoreDimension["GUARANTOR_RELIABILITY"] = "guarantor_reliability";
})(ScoreDimension || (exports.ScoreDimension = ScoreDimension = {}));
var ScoreSeverity;
(function (ScoreSeverity) {
    ScoreSeverity["STANDARD"] = "standard";
    ScoreSeverity["ELEVATED"] = "elevated";
    ScoreSeverity["SEVERE"] = "severe";
})(ScoreSeverity || (exports.ScoreSeverity = ScoreSeverity = {}));
var ScoreBand;
(function (ScoreBand) {
    ScoreBand["HIGH_RISK"] = "high_risk";
    ScoreBand["MEDIUM_TRUST"] = "medium_trust";
    ScoreBand["GOOD_TRUST"] = "good_trust";
    ScoreBand["VERY_GOOD_TRUST"] = "very_good_trust";
    ScoreBand["ELITE_TRUST"] = "elite_trust";
})(ScoreBand || (exports.ScoreBand = ScoreBand = {}));
var SourceTrustLevel;
(function (SourceTrustLevel) {
    SourceTrustLevel["SYSTEM_VERIFIED"] = "system_verified";
    SourceTrustLevel["STAFF_VERIFIED"] = "staff_verified";
    SourceTrustLevel["PARTNER_REPORTED"] = "partner_reported";
    SourceTrustLevel["STUDENT_REPORTED"] = "student_reported";
})(SourceTrustLevel || (exports.SourceTrustLevel = SourceTrustLevel = {}));
var DocumentStatus;
(function (DocumentStatus) {
    DocumentStatus["ABSENT"] = "absent";
    DocumentStatus["UPLOADED"] = "uploaded";
    DocumentStatus["UNDER_REVIEW"] = "under_review";
    DocumentStatus["VERIFIED"] = "verified";
    DocumentStatus["REJECTED"] = "rejected";
    DocumentStatus["EXPIRED"] = "expired";
    DocumentStatus["SUPERSEDED"] = "superseded";
})(DocumentStatus || (exports.DocumentStatus = DocumentStatus = {}));
var ContractType;
(function (ContractType) {
    ContractType["STUDENT_FORSA"] = "student_forsa";
    ContractType["FORSA_UNIVERSITY"] = "forsa_university";
    ContractType["STUDENT_UNIVERSITY"] = "student_university";
    ContractType["GUARANTOR_FORSA"] = "guarantor_forsa";
})(ContractType || (exports.ContractType = ContractType = {}));
var ContractStatus;
(function (ContractStatus) {
    ContractStatus["DRAFT"] = "draft";
    ContractStatus["SENT_FOR_SIGNATURE"] = "sent_for_signature";
    ContractStatus["PARTIALLY_SIGNED"] = "partially_signed";
    ContractStatus["FULLY_SIGNED"] = "fully_signed";
    ContractStatus["ACTIVE"] = "active";
    ContractStatus["AMENDED"] = "amended";
    ContractStatus["TERMINATED"] = "terminated";
    ContractStatus["EXPIRED"] = "expired";
    ContractStatus["VOIDED"] = "voided";
})(ContractStatus || (exports.ContractStatus = ContractStatus = {}));
var ExecutionStatus;
(function (ExecutionStatus) {
    ExecutionStatus["PENDING"] = "pending";
    ExecutionStatus["EXECUTING"] = "executing";
    ExecutionStatus["COMMITTED"] = "committed";
    ExecutionStatus["ROLLED_BACK"] = "rolled_back";
    ExecutionStatus["FAILED"] = "failed";
    ExecutionStatus["DUPLICATE_REJECTED"] = "duplicate_rejected";
})(ExecutionStatus || (exports.ExecutionStatus = ExecutionStatus = {}));
var PolicyScopeType;
(function (PolicyScopeType) {
    PolicyScopeType["GLOBAL"] = "global";
    PolicyScopeType["COUNTRY"] = "country";
    PolicyScopeType["UNIVERSITY"] = "university";
    PolicyScopeType["PARTNER"] = "partner";
    PolicyScopeType["STUDENT"] = "student";
    PolicyScopeType["PROGRAM"] = "program";
})(PolicyScopeType || (exports.PolicyScopeType = PolicyScopeType = {}));
var PolicyStatus;
(function (PolicyStatus) {
    PolicyStatus["DRAFT"] = "draft";
    PolicyStatus["PENDING_APPROVAL"] = "pending_approval";
    PolicyStatus["ACTIVE"] = "active";
    PolicyStatus["SUPERSEDED"] = "superseded";
    PolicyStatus["EXPIRED"] = "expired";
    PolicyStatus["REVOKED"] = "revoked";
})(PolicyStatus || (exports.PolicyStatus = PolicyStatus = {}));
var UniversityStatus;
(function (UniversityStatus) {
    UniversityStatus["PROSPECT"] = "prospect";
    UniversityStatus["CONTACT"] = "contact";
    UniversityStatus["NEGOTIATION"] = "negotiation";
    UniversityStatus["ACTIVE"] = "active";
    UniversityStatus["SUSPENDED"] = "suspended";
    UniversityStatus["TERMINATED"] = "terminated";
})(UniversityStatus || (exports.UniversityStatus = UniversityStatus = {}));
var PartnerType;
(function (PartnerType) {
    PartnerType["PLATFORM"] = "platform";
    PartnerType["AMBASSADOR"] = "ambassador";
    PartnerType["UNIVERSITY"] = "university";
    PartnerType["AGENCY"] = "agency";
    PartnerType["EVENT"] = "event";
    PartnerType["DIRECT"] = "direct";
    PartnerType["OTHER"] = "other";
})(PartnerType || (exports.PartnerType = PartnerType = {}));
var CommissionStatus;
(function (CommissionStatus) {
    CommissionStatus["LEAD"] = "lead";
    CommissionStatus["ELIGIBLE"] = "eligible";
    CommissionStatus["APPROVED"] = "approved";
    CommissionStatus["UNIVERSITY_PAID"] = "university_paid";
    CommissionStatus["PAYABLE"] = "payable";
    CommissionStatus["PAID"] = "paid";
    CommissionStatus["CLAWBACK_INITIATED"] = "clawback_initiated";
    CommissionStatus["CLAWED_BACK"] = "clawed_back";
    CommissionStatus["CANCELLED"] = "cancelled";
})(CommissionStatus || (exports.CommissionStatus = CommissionStatus = {}));
var ExceptionalEventType;
(function (ExceptionalEventType) {
    ExceptionalEventType["VOLUNTARY_WITHDRAWAL"] = "voluntary_withdrawal";
    ExceptionalEventType["ACADEMIC_DISMISSAL"] = "academic_dismissal";
    ExceptionalEventType["MEDICAL_WITHDRAWAL"] = "medical_withdrawal";
    ExceptionalEventType["TRANSFER"] = "transfer";
    ExceptionalEventType["VISA_ADMINISTRATIVE"] = "visa_administrative";
    ExceptionalEventType["FORCE_MAJEURE"] = "force_majeure";
    ExceptionalEventType["UNIVERSITY_CLOSURE"] = "university_closure";
    ExceptionalEventType["PROGRAM_CANCELLATION"] = "program_cancellation";
    ExceptionalEventType["TUITION_MODIFICATION"] = "tuition_modification";
    ExceptionalEventType["ACCREDITATION_LOSS"] = "accreditation_loss";
    ExceptionalEventType["STUDENT_DEATH"] = "student_death";
    ExceptionalEventType["STUDENT_INCAPACITATION"] = "student_incapacitation";
    ExceptionalEventType["GUARANTOR_WITHDRAWAL"] = "guarantor_withdrawal";
    ExceptionalEventType["CONTRACT_BREACH"] = "contract_breach";
    ExceptionalEventType["OTHER"] = "other";
})(ExceptionalEventType || (exports.ExceptionalEventType = ExceptionalEventType = {}));
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["EMAIL"] = "email";
    NotificationChannel["SMS"] = "sms";
    NotificationChannel["WHATSAPP"] = "whatsapp";
    NotificationChannel["IN_APP"] = "in_app";
    NotificationChannel["PUSH"] = "push";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
var MfaMethod;
(function (MfaMethod) {
    MfaMethod["TOTP"] = "totp";
    MfaMethod["SMS"] = "sms";
    MfaMethod["EMAIL"] = "email";
})(MfaMethod || (exports.MfaMethod = MfaMethod = {}));
var PipelineRunStatus;
(function (PipelineRunStatus) {
    PipelineRunStatus["ACTIVE"] = "active";
    PipelineRunStatus["COMPLETED"] = "completed";
    PipelineRunStatus["CANCELLED"] = "cancelled";
    PipelineRunStatus["SUPERSEDED"] = "superseded";
})(PipelineRunStatus || (exports.PipelineRunStatus = PipelineRunStatus = {}));
var ApprovalSequencing;
(function (ApprovalSequencing) {
    ApprovalSequencing["SEQUENTIAL"] = "sequential";
    ApprovalSequencing["PARALLEL"] = "parallel";
    ApprovalSequencing["HYBRID"] = "hybrid";
})(ApprovalSequencing || (exports.ApprovalSequencing = ApprovalSequencing = {}));
var SecurityEventType;
(function (SecurityEventType) {
    SecurityEventType["LOGIN_SUCCESS"] = "login_success";
    SecurityEventType["LOGIN_FAILURE"] = "login_failure";
    SecurityEventType["LOGIN_BLOCKED"] = "login_blocked";
    SecurityEventType["MFA_SUCCESS"] = "mfa_success";
    SecurityEventType["MFA_FAILURE"] = "mfa_failure";
    SecurityEventType["PASSWORD_CHANGED"] = "password_changed";
    SecurityEventType["SESSION_INVALIDATED"] = "session_invalidated";
    SecurityEventType["PERMISSION_DENIED"] = "permission_denied";
    SecurityEventType["RATE_LIMIT_TRIGGERED"] = "rate_limit_triggered";
    SecurityEventType["SUSPICIOUS_REQUEST"] = "suspicious_request";
    SecurityEventType["TOKEN_REUSE_ATTEMPT"] = "token_reuse_attempt";
    SecurityEventType["ACCOUNT_LOCKED"] = "account_locked";
    SecurityEventType["ACCOUNT_UNLOCKED"] = "account_unlocked";
    SecurityEventType["ROLE_ELEVATED"] = "role_elevated";
    SecurityEventType["ADMIN_ACTION"] = "admin_action";
    SecurityEventType["IMMUTABILITY_VIOLATION_ATTEMPT"] = "immutability_violation_attempt";
})(SecurityEventType || (exports.SecurityEventType = SecurityEventType = {}));
var StudentStatus;
(function (StudentStatus) {
    StudentStatus["LEAD"] = "lead";
    StudentStatus["ACTIVE"] = "active";
    StudentStatus["COMPLETED"] = "completed";
    StudentStatus["WITHDRAWN"] = "withdrawn";
    StudentStatus["DEFAULTED"] = "defaulted";
    StudentStatus["DECEASED"] = "deceased";
    StudentStatus["SUSPENDED"] = "suspended";
})(StudentStatus || (exports.StudentStatus = StudentStatus = {}));
var MembershipStatus;
(function (MembershipStatus) {
    MembershipStatus["BRONZE"] = "bronze";
    MembershipStatus["SILVER"] = "silver";
    MembershipStatus["GOLD"] = "gold";
    MembershipStatus["BLACKLISTED"] = "blacklisted";
})(MembershipStatus || (exports.MembershipStatus = MembershipStatus = {}));
var MembershipRequestStatus;
(function (MembershipRequestStatus) {
    MembershipRequestStatus["PENDING"] = "pending";
    MembershipRequestStatus["APPROVED"] = "approved";
    MembershipRequestStatus["REJECTED"] = "rejected";
})(MembershipRequestStatus || (exports.MembershipRequestStatus = MembershipRequestStatus = {}));
//# sourceMappingURL=index.js.map