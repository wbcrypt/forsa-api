export declare class ScheduleMeetingDto {
    scheduledAt: string;
    officeLocation: string;
    assignedOfficerUserId?: string;
    estimatedDurationMinutes?: number;
    requiredDocuments?: string[];
    requiredAttendees?: string[];
    specialInstructions?: string;
}
export declare class UpdateMeetingStatusDto {
    status: string;
    cancellationReason?: string;
    newScheduledAt?: string;
}
