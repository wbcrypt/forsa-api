import { ApplicationStatus } from '../common/enums';

/**
 * Two different views of the same application, computed from a single
 * shared source of truth so they can never drift apart from each other.
 *
 * Why two views at all: the CRM-flavored `applications.current_status`
 * enum (new_lead, contacted, waiting_for_documents, approved_level2,
 * contract_signed, ...) is the correct internal operational vocabulary for
 * staff — it mixes intake, automated-gate, and post-decision stages
 * because that's genuinely how the internal process works. But showing
 * that same vocabulary to a student ("contacted"? "capital_queue"?) fails
 * the platform's own first principle: students always know the next step
 * in language they understand. These two functions translate the one
 * underlying `current_status` (plus document/guarantor completeness, which
 * `current_status` alone doesn't capture) into the two audience-appropriate
 * vocabularies — never storing a second status anywhere, so there is
 * nothing to keep in sync by hand and nothing that can silently disagree.
 */

export const ADMIN_STAGE_KEYS = [
  'draft', 'submitted', 'completeness_verification', 'guarantor', 'ai_review',
  'internal_review', 'pre_approval', 'contract', 'university_confirmation',
  'approved', 'university_payment', 'active_student',
] as const;
export type AdminStageKey = typeof ADMIN_STAGE_KEYS[number];

export const ADMIN_STAGE_LABELS: Record<AdminStageKey, string> = {
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

// Terminal/exceptional outcomes that sit outside the linear 12-stage
// happy path — rejection, fraud, and withdrawal are real outcomes, not
// "stuck at stage N," and are never the end of the relationship (rejected
// students keep Bronze and can reapply; see FORSA_PRINCIPLES.md).
export type AdminExceptionKey = 'rejected' | 'fraud_flagged' | 'withdrawn';
const ADMIN_EXCEPTION_LABELS: Record<AdminExceptionKey, string> = {
  rejected: 'Rejected',
  fraud_flagged: 'Fraud — Blacklisted',
  withdrawn: 'Withdrawn',
};

export interface AdminStageView {
  currentKey: AdminStageKey | AdminExceptionKey;
  currentLabel: string;
  isException: boolean;
  isWaitingList: boolean; // capital_queue folds into internal_review but keeps its own distinct framing (never worded as a rejection)
  stages: { key: AdminStageKey; label: string; status: 'done' | 'current' | 'upcoming' }[];
}

interface CompletenessInput {
  documents: { type: string; status: string }[];
  guarantor: { status: string } | null;
}

// QA-8 fix — Phase 14 (Final Case Flow Refinement) removed document
// upload from the application entirely ("no document upload during the
// application; documents are verified physically during the meeting").
// This function used to gate both the Admin Pipeline stage and the
// Student Timeline milestone on application_documents rows that no
// application created after Phase 14 will ever have, permanently
// stalling every new Case at "Completeness Verification" /
// "Documents Verified" — exactly the stale-checklist symptom reported
// in manual QA. Documents are no longer a completeness dimension at
// all; always true so this stage/milestone is satisfied immediately,
// consistent with pipeline.service.ts#stage1Completeness (which Phase 14
// already correctly updated to check requested_tier/
// platform_fee_acknowledged_at instead of documents).
function docsAllVerified(_completeness: CompletenessInput): boolean {
  return true;
}
function guarantorActive(completeness: CompletenessInput): boolean {
  return completeness.guarantor?.status === 'active';
}
function guarantorAtLeastInvited(completeness: CompletenessInput): boolean {
  return !!completeness.guarantor && ['active', 'pending_invitation'].includes(completeness.guarantor.status);
}

/** Admin Pipeline — the internal operational process. */
export function computeAdminStage(currentStatus: string, completeness: CompletenessInput): AdminStageView {
  const exceptionMap: Partial<Record<string, AdminExceptionKey>> = {
    [ApplicationStatus.REJECTED]: 'rejected',
    [ApplicationStatus.FRAUD_FLAGGED]: 'fraud_flagged',
    [ApplicationStatus.WITHDRAWN]: 'withdrawn',
  };
  const exceptionKey = exceptionMap[currentStatus];

  let currentKey: AdminStageKey;
  if ([ApplicationStatus.NEW_LEAD, ApplicationStatus.CONTACTED].includes(currentStatus as ApplicationStatus)) {
    if (!docsAllVerified(completeness)) currentKey = 'completeness_verification';
    else if (!guarantorActive(completeness)) currentKey = 'guarantor';
    else currentKey = 'ai_review';
  } else if ([ApplicationStatus.WAITING_FOR_DOCUMENTS, ApplicationStatus.DOCUMENTS_RECEIVED].includes(currentStatus as ApplicationStatus)) {
    currentKey = 'completeness_verification';
  } else if ([
    ApplicationStatus.UNDER_REVIEW, ApplicationStatus.MORE_INFO_REQUIRED,
    ApplicationStatus.ON_HOLD, ApplicationStatus.CAPITAL_QUEUE, ApplicationStatus.APPEALING,
  ].includes(currentStatus as ApplicationStatus)) {
    currentKey = 'internal_review';
  } else if ([
    ApplicationStatus.APPROVED_LEVEL1, ApplicationStatus.APPROVED_LEVEL2, ApplicationStatus.APPROVED_LEVEL3,
  ].includes(currentStatus as ApplicationStatus)) {
    currentKey = 'pre_approval';
  } else if ([ApplicationStatus.CONTRACT_SENT, ApplicationStatus.CONTRACT_SIGNED].includes(currentStatus as ApplicationStatus)) {
    currentKey = 'contract';
  } else if (currentStatus === ApplicationStatus.UNIVERSITY_CONFIRMED) {
    currentKey = 'university_confirmation';
  } else if (currentStatus === ApplicationStatus.UNIVERSITY_PAID) {
    currentKey = 'university_payment';
  } else if ([ApplicationStatus.ACTIVE_STUDENT, ApplicationStatus.COMPLETED].includes(currentStatus as ApplicationStatus)) {
    currentKey = 'active_student';
  } else {
    currentKey = 'submitted';
  }

  const currentIndex = ADMIN_STAGE_KEYS.indexOf(currentKey);
  // "Approved" has no distinct stored status of its own — it represents
  // the fully-ratified decision that exists between the university
  // confirming enrollment and funds actually moving. Rather than invent a
  // new stored value for a single instantaneous checkpoint, it completes
  // together with University Confirmation once the application has
  // progressed to University Payment or beyond.
  const approvedIndex = ADMIN_STAGE_KEYS.indexOf('approved');
  const universityConfirmationIndex = ADMIN_STAGE_KEYS.indexOf('university_confirmation');

  const stages = ADMIN_STAGE_KEYS.map((key, idx) => {
    let status: 'done' | 'current' | 'upcoming';
    if (key === 'approved') {
      status = currentIndex > universityConfirmationIndex ? 'done' : idx === currentIndex ? 'current' : 'upcoming';
    } else if (idx < currentIndex || (idx === approvedIndex && currentIndex > universityConfirmationIndex)) {
      status = 'done';
    } else if (idx === currentIndex) {
      status = exceptionKey ? 'done' : 'current';
    } else {
      status = 'upcoming';
    }
    return { key, label: ADMIN_STAGE_LABELS[key], status };
  });

  return {
    currentKey: exceptionKey || currentKey,
    currentLabel: exceptionKey ? ADMIN_EXCEPTION_LABELS[exceptionKey] : ADMIN_STAGE_LABELS[currentKey],
    isException: !!exceptionKey,
    isWaitingList: currentStatus === ApplicationStatus.CAPITAL_QUEUE,
    stages,
  };
}

export const STUDENT_MILESTONE_KEYS = [
  'application_started', 'application_submitted', 'documents_verified',
  'guarantor_status', 'under_review', 'decision', 'university_confirmation', 'active_student',
] as const;
export type StudentMilestoneKey = typeof STUDENT_MILESTONE_KEYS[number];

const STUDENT_MILESTONE_LABELS: Record<StudentMilestoneKey, string> = {
  application_started: 'Application Started',
  application_submitted: 'Application Submitted',
  documents_verified: 'Documents Verified',
  guarantor_status: 'Guarantor Status',
  under_review: 'Under Review',
  decision: 'Decision',
  university_confirmation: 'University Confirmation',
  active_student: 'Active Student',
};

export interface StudentMilestoneView {
  milestones: {
    key: StudentMilestoneKey; label: string; status: 'done' | 'current' | 'upcoming';
    detail?: string; // e.g. the live guarantor status, or the decision outcome
  }[];
  isWaitingList: boolean;
  isRejected: boolean;
  nextAction: string;
  meeting: MeetingInput | null;
}

interface MeetingInput {
  status: string;
  scheduled_at: string | Date;
  [key: string]: unknown;
}

/**
 * Phase 13 (Case Management) — "Student should always know: Case Status,
 * Case Progress, Next Required Action." One required action in plain
 * language, computed from the exact same inputs as the milestones
 * themselves so it can never point somewhere the milestones disagree with.
 */
function computeNextAction(currentKey: StudentMilestoneKey, isRejected: boolean, completeness: CompletenessInput, meeting?: MeetingInput | null): string {
  if (isRejected) return 'Review your options — Bronze membership stays fully active, and you can apply again anytime';
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

/** Student Timeline — the customer journey, in plain language. */
export function computeStudentMilestone(currentStatus: string, completeness: CompletenessInput, meeting?: MeetingInput | null): StudentMilestoneView {
  const isRejected = currentStatus === ApplicationStatus.REJECTED;
  const isWaitingList = currentStatus === ApplicationStatus.CAPITAL_QUEUE;

  const reachedUnderReview = [
    ApplicationStatus.UNDER_REVIEW, ApplicationStatus.MORE_INFO_REQUIRED, ApplicationStatus.ON_HOLD,
    ApplicationStatus.CAPITAL_QUEUE, ApplicationStatus.APPEALING,
    ApplicationStatus.APPROVED_LEVEL1, ApplicationStatus.APPROVED_LEVEL2, ApplicationStatus.APPROVED_LEVEL3,
    ApplicationStatus.REJECTED, ApplicationStatus.CONTRACT_SENT, ApplicationStatus.CONTRACT_SIGNED,
    ApplicationStatus.UNIVERSITY_CONFIRMED, ApplicationStatus.UNIVERSITY_PAID,
    ApplicationStatus.ACTIVE_STUDENT, ApplicationStatus.COMPLETED, ApplicationStatus.WITHDRAWN,
  ].includes(currentStatus as ApplicationStatus);

  const decisionMade = [
    ApplicationStatus.APPROVED_LEVEL1, ApplicationStatus.APPROVED_LEVEL2, ApplicationStatus.APPROVED_LEVEL3,
    ApplicationStatus.REJECTED, ApplicationStatus.CONTRACT_SENT, ApplicationStatus.CONTRACT_SIGNED,
    ApplicationStatus.UNIVERSITY_CONFIRMED, ApplicationStatus.UNIVERSITY_PAID,
    ApplicationStatus.ACTIVE_STUDENT, ApplicationStatus.COMPLETED,
  ].includes(currentStatus as ApplicationStatus);

  const universityConfirmed = [
    ApplicationStatus.UNIVERSITY_CONFIRMED, ApplicationStatus.UNIVERSITY_PAID,
    ApplicationStatus.ACTIVE_STUDENT, ApplicationStatus.COMPLETED,
  ].includes(currentStatus as ApplicationStatus);

  const isActiveStudent = [ApplicationStatus.ACTIVE_STUDENT, ApplicationStatus.COMPLETED].includes(currentStatus as ApplicationStatus);

  let currentKey: StudentMilestoneKey = 'application_submitted';
  if (isActiveStudent) currentKey = 'active_student';
  else if (universityConfirmed) currentKey = 'university_confirmation';
  else if (decisionMade) currentKey = 'decision';
  else if (reachedUnderReview) currentKey = 'under_review';
  else if (!guarantorAtLeastInvited(completeness)) currentKey = 'guarantor_status';
  else if (!docsAllVerified(completeness)) currentKey = 'documents_verified';

  const order: StudentMilestoneKey[] = [
    'application_started', 'application_submitted', 'documents_verified',
    'guarantor_status', 'under_review', 'decision', 'university_confirmation', 'active_student',
  ];
  const currentIndex = order.indexOf(currentKey);

  const guarantorDetailMap: Record<string, string> = {
    active: 'Accepted', pending_invitation: 'Pending', declined: 'Declined',
  };
  const decisionDetail = isRejected
    ? 'Not approved this time — Bronze membership stays fully active'
    : decisionMade ? 'Approved' : undefined;

  const milestones = order.map((key, idx) => {
    let status: 'done' | 'current' | 'upcoming';
    if (idx < currentIndex) status = 'done';
    else if (idx === currentIndex) status = 'current';
    else status = 'upcoming';

    let detail: string | undefined;
    if (key === 'guarantor_status') detail = completeness.guarantor ? guarantorDetailMap[completeness.guarantor.status] : 'Not added yet';
    if (key === 'decision' && (status === 'done' || status === 'current')) detail = decisionDetail;

    return { key, label: STUDENT_MILESTONE_LABELS[key], status, detail };
  });

  return {
    milestones, isWaitingList, isRejected,
    nextAction: computeNextAction(currentKey, isRejected, completeness, meeting),
    meeting: meeting || null,
  };
}
