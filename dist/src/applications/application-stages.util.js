"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STUDENT_MILESTONE_KEYS = exports.ADMIN_STAGE_LABELS = exports.ADMIN_STAGE_KEYS = void 0;
exports.computeAdminStage = computeAdminStage;
exports.computeStudentMilestone = computeStudentMilestone;
const enums_1 = require("../common/enums");
exports.ADMIN_STAGE_KEYS = [
    'draft', 'submitted', 'completeness_verification', 'guarantor', 'ai_review',
    'internal_review', 'pre_approval', 'contract', 'university_confirmation',
    'approved', 'university_payment', 'active_student',
];
exports.ADMIN_STAGE_LABELS = {
    draft: 'Draft',
    submitted: 'Submitted',
    completeness_verification: 'Completeness Verification',
    guarantor: 'Guarantor',
    ai_review: 'AI Review',
    internal_review: 'Internal Review',
    pre_approval: 'Pre-Approval',
    contract: 'Contract',
    university_confirmation: 'University Confirmation',
    approved: 'Approved',
    university_payment: 'University Payment',
    active_student: 'Active Student',
};
const ADMIN_EXCEPTION_LABELS = {
    rejected: 'Rejected',
    fraud_flagged: 'Fraud — Blacklisted',
    withdrawn: 'Withdrawn',
};
function docsAllVerified(_completeness) {
    return true;
}
function guarantorActive(completeness) {
    return completeness.guarantor?.status === 'active';
}
function guarantorAtLeastInvited(completeness) {
    return !!completeness.guarantor && ['active', 'pending_invitation'].includes(completeness.guarantor.status);
}
function computeAdminStage(currentStatus, completeness) {
    const exceptionMap = {
        [enums_1.ApplicationStatus.REJECTED]: 'rejected',
        [enums_1.ApplicationStatus.FRAUD_FLAGGED]: 'fraud_flagged',
        [enums_1.ApplicationStatus.WITHDRAWN]: 'withdrawn',
    };
    const exceptionKey = exceptionMap[currentStatus];
    let currentKey;
    if ([enums_1.ApplicationStatus.NEW_LEAD, enums_1.ApplicationStatus.CONTACTED].includes(currentStatus)) {
        if (!docsAllVerified(completeness))
            currentKey = 'completeness_verification';
        else if (!guarantorActive(completeness))
            currentKey = 'guarantor';
        else
            currentKey = 'ai_review';
    }
    else if ([enums_1.ApplicationStatus.WAITING_FOR_DOCUMENTS, enums_1.ApplicationStatus.DOCUMENTS_RECEIVED].includes(currentStatus)) {
        currentKey = 'completeness_verification';
    }
    else if ([
        enums_1.ApplicationStatus.UNDER_REVIEW, enums_1.ApplicationStatus.MORE_INFO_REQUIRED,
        enums_1.ApplicationStatus.ON_HOLD, enums_1.ApplicationStatus.CAPITAL_QUEUE, enums_1.ApplicationStatus.APPEALING,
    ].includes(currentStatus)) {
        currentKey = 'internal_review';
    }
    else if ([
        enums_1.ApplicationStatus.APPROVED_LEVEL1, enums_1.ApplicationStatus.APPROVED_LEVEL2, enums_1.ApplicationStatus.APPROVED_LEVEL3,
    ].includes(currentStatus)) {
        currentKey = 'pre_approval';
    }
    else if ([enums_1.ApplicationStatus.CONTRACT_SENT, enums_1.ApplicationStatus.CONTRACT_SIGNED].includes(currentStatus)) {
        currentKey = 'contract';
    }
    else if (currentStatus === enums_1.ApplicationStatus.UNIVERSITY_CONFIRMED) {
        currentKey = 'university_confirmation';
    }
    else if (currentStatus === enums_1.ApplicationStatus.UNIVERSITY_PAID) {
        currentKey = 'university_payment';
    }
    else if ([enums_1.ApplicationStatus.ACTIVE_STUDENT, enums_1.ApplicationStatus.COMPLETED].includes(currentStatus)) {
        currentKey = 'active_student';
    }
    else {
        currentKey = 'submitted';
    }
    const currentIndex = exports.ADMIN_STAGE_KEYS.indexOf(currentKey);
    const approvedIndex = exports.ADMIN_STAGE_KEYS.indexOf('approved');
    const universityConfirmationIndex = exports.ADMIN_STAGE_KEYS.indexOf('university_confirmation');
    const stages = exports.ADMIN_STAGE_KEYS.map((key, idx) => {
        let status;
        if (key === 'approved') {
            status = currentIndex > universityConfirmationIndex ? 'done' : idx === currentIndex ? 'current' : 'upcoming';
        }
        else if (idx < currentIndex || (idx === approvedIndex && currentIndex > universityConfirmationIndex)) {
            status = 'done';
        }
        else if (idx === currentIndex) {
            status = exceptionKey ? 'done' : 'current';
        }
        else {
            status = 'upcoming';
        }
        return { key, label: exports.ADMIN_STAGE_LABELS[key], status };
    });
    return {
        currentKey: exceptionKey || currentKey,
        currentLabel: exceptionKey ? ADMIN_EXCEPTION_LABELS[exceptionKey] : exports.ADMIN_STAGE_LABELS[currentKey],
        isException: !!exceptionKey,
        isWaitingList: currentStatus === enums_1.ApplicationStatus.CAPITAL_QUEUE,
        stages,
    };
}
exports.STUDENT_MILESTONE_KEYS = [
    'application_started', 'application_submitted', 'documents_verified',
    'guarantor_status', 'under_review', 'decision', 'university_confirmation', 'active_student',
];
const STUDENT_MILESTONE_LABELS = {
    application_started: 'Application Started',
    application_submitted: 'Application Submitted',
    documents_verified: 'Documents Verified',
    guarantor_status: 'Guarantor Status',
    under_review: 'Under Review',
    decision: 'Decision',
    university_confirmation: 'University Confirmation',
    active_student: 'Active Student',
};
function computeNextAction(currentKey, isRejected, completeness, meeting) {
    if (isRejected)
        return 'Review your options — Bronze membership stays fully active, and you can apply again anytime';
    switch (currentKey) {
        case 'guarantor_status':
            return completeness.guarantor?.status === 'declined' ? 'Invite a new guarantor — your previous one declined' : 'Invite a guarantor to continue';
        case 'documents_verified':
            return 'Upload any remaining required documents';
        case 'under_review':
            return 'No action needed — FORSA is reviewing your case';
        case 'decision':
            if (meeting && ['scheduled', 'confirmed'].includes(meeting.status)) {
                return `Attend your meeting on ${new Date(meeting.scheduled_at).toLocaleDateString()}`;
            }
            return 'Congratulations — waiting for your activation meeting to be scheduled';
        case 'university_confirmation':
            return 'No action needed — waiting for your university to confirm enrollment';
        case 'active_student':
            return 'No action needed — your Tuition Facilitation Plan is active';
        default:
            return 'Complete your application';
    }
}
function computeStudentMilestone(currentStatus, completeness, meeting) {
    const isRejected = currentStatus === enums_1.ApplicationStatus.REJECTED;
    const isWaitingList = currentStatus === enums_1.ApplicationStatus.CAPITAL_QUEUE;
    const reachedUnderReview = [
        enums_1.ApplicationStatus.UNDER_REVIEW, enums_1.ApplicationStatus.MORE_INFO_REQUIRED, enums_1.ApplicationStatus.ON_HOLD,
        enums_1.ApplicationStatus.CAPITAL_QUEUE, enums_1.ApplicationStatus.APPEALING,
        enums_1.ApplicationStatus.APPROVED_LEVEL1, enums_1.ApplicationStatus.APPROVED_LEVEL2, enums_1.ApplicationStatus.APPROVED_LEVEL3,
        enums_1.ApplicationStatus.REJECTED, enums_1.ApplicationStatus.CONTRACT_SENT, enums_1.ApplicationStatus.CONTRACT_SIGNED,
        enums_1.ApplicationStatus.UNIVERSITY_CONFIRMED, enums_1.ApplicationStatus.UNIVERSITY_PAID,
        enums_1.ApplicationStatus.ACTIVE_STUDENT, enums_1.ApplicationStatus.COMPLETED, enums_1.ApplicationStatus.WITHDRAWN,
    ].includes(currentStatus);
    const decisionMade = [
        enums_1.ApplicationStatus.APPROVED_LEVEL1, enums_1.ApplicationStatus.APPROVED_LEVEL2, enums_1.ApplicationStatus.APPROVED_LEVEL3,
        enums_1.ApplicationStatus.REJECTED, enums_1.ApplicationStatus.CONTRACT_SENT, enums_1.ApplicationStatus.CONTRACT_SIGNED,
        enums_1.ApplicationStatus.UNIVERSITY_CONFIRMED, enums_1.ApplicationStatus.UNIVERSITY_PAID,
        enums_1.ApplicationStatus.ACTIVE_STUDENT, enums_1.ApplicationStatus.COMPLETED,
    ].includes(currentStatus);
    const universityConfirmed = [
        enums_1.ApplicationStatus.UNIVERSITY_CONFIRMED, enums_1.ApplicationStatus.UNIVERSITY_PAID,
        enums_1.ApplicationStatus.ACTIVE_STUDENT, enums_1.ApplicationStatus.COMPLETED,
    ].includes(currentStatus);
    const isActiveStudent = [enums_1.ApplicationStatus.ACTIVE_STUDENT, enums_1.ApplicationStatus.COMPLETED].includes(currentStatus);
    let currentKey = 'application_submitted';
    if (isActiveStudent)
        currentKey = 'active_student';
    else if (universityConfirmed)
        currentKey = 'university_confirmation';
    else if (decisionMade)
        currentKey = 'decision';
    else if (reachedUnderReview)
        currentKey = 'under_review';
    else if (!guarantorAtLeastInvited(completeness))
        currentKey = 'guarantor_status';
    else if (!docsAllVerified(completeness))
        currentKey = 'documents_verified';
    const order = [
        'application_started', 'application_submitted', 'documents_verified',
        'guarantor_status', 'under_review', 'decision', 'university_confirmation', 'active_student',
    ];
    const currentIndex = order.indexOf(currentKey);
    const guarantorDetailMap = {
        active: 'Accepted', pending_invitation: 'Pending', declined: 'Declined',
    };
    const decisionDetail = isRejected
        ? 'Not approved this time — Bronze membership stays fully active'
        : decisionMade ? 'Approved' : undefined;
    const milestones = order.map((key, idx) => {
        let status;
        if (idx < currentIndex)
            status = 'done';
        else if (idx === currentIndex)
            status = 'current';
        else
            status = 'upcoming';
        let detail;
        if (key === 'guarantor_status')
            detail = completeness.guarantor ? guarantorDetailMap[completeness.guarantor.status] : 'Not added yet';
        if (key === 'decision' && (status === 'done' || status === 'current'))
            detail = decisionDetail;
        return { key, label: STUDENT_MILESTONE_LABELS[key], status, detail };
    });
    return {
        milestones, isWaitingList, isRejected,
        nextAction: computeNextAction(currentKey, isRejected, completeness, meeting),
        meeting: meeting || null,
    };
}
//# sourceMappingURL=application-stages.util.js.map