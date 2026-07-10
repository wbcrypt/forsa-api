export declare const ADMIN_STAGE_KEYS: readonly ["draft", "submitted", "completeness_verification", "guarantor", "ai_review", "internal_review", "pre_approval", "contract", "university_confirmation", "approved", "university_payment", "active_student"];
export type AdminStageKey = typeof ADMIN_STAGE_KEYS[number];
export declare const ADMIN_STAGE_LABELS: Record<AdminStageKey, string>;
export type AdminExceptionKey = 'rejected' | 'fraud_flagged' | 'withdrawn';
export interface AdminStageView {
    currentKey: AdminStageKey | AdminExceptionKey;
    currentLabel: string;
    isException: boolean;
    isWaitingList: boolean;
    stages: {
        key: AdminStageKey;
        label: string;
        status: 'done' | 'current' | 'upcoming';
    }[];
}
interface CompletenessInput {
    documents: {
        type: string;
        status: string;
    }[];
    guarantor: {
        status: string;
    } | null;
}
export declare function computeAdminStage(currentStatus: string, completeness: CompletenessInput): AdminStageView;
export declare const STUDENT_MILESTONE_KEYS: readonly ["application_started", "application_submitted", "documents_verified", "guarantor_status", "under_review", "decision", "university_confirmation", "active_student"];
export type StudentMilestoneKey = typeof STUDENT_MILESTONE_KEYS[number];
export interface StudentMilestoneView {
    milestones: {
        key: StudentMilestoneKey;
        label: string;
        status: 'done' | 'current' | 'upcoming';
        detail?: string;
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
export declare function computeStudentMilestone(currentStatus: string, completeness: CompletenessInput, meeting?: MeetingInput | null): StudentMilestoneView;
export {};
