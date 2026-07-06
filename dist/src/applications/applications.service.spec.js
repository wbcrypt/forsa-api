"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const applications_service_1 = require("./applications.service");
const enums_1 = require("../common/enums");
describe('ApplicationsService.transitionStatus', () => {
    let service;
    let query;
    let notifications;
    const baseApplication = {
        id: 'app-1',
        tenant_id: 'tenant-1',
        student_id: 'student-1',
        current_status: enums_1.ApplicationStatus.NEW_LEAD,
        first_name: 'Amina',
        last_name: 'Trabelsi',
        email: 'amina@example.com',
        university_name: 'Université de Tunis',
        program_name: 'Génie Informatique',
    };
    beforeEach(() => {
        query = jest.fn();
        notifications = { send: jest.fn().mockResolvedValue(undefined) };
        service = new applications_service_1.ApplicationsService({ query }, notifications, {});
    });
    it('allows a legal transition and records status history', async () => {
        query
            .mockResolvedValueOnce([baseApplication])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);
        const result = await service.transitionStatus('app-1', 'tenant-1', enums_1.ApplicationStatus.CONTACTED, 'staff-1', 'Called the student');
        expect(result).toEqual({
            id: 'app-1', previousStatus: enums_1.ApplicationStatus.NEW_LEAD, newStatus: enums_1.ApplicationStatus.CONTACTED,
        });
        expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE applications SET current_status'), ['app-1', 'tenant-1', enums_1.ApplicationStatus.CONTACTED]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO application_status_history'), ['app-1', enums_1.ApplicationStatus.NEW_LEAD, enums_1.ApplicationStatus.CONTACTED, 'staff-1', null, 'Called the student']);
        expect(notifications.send).not.toHaveBeenCalled();
    });
    it('rejects an illegal transition without writing anything', async () => {
        query.mockResolvedValueOnce([baseApplication]);
        await expect(service.transitionStatus('app-1', 'tenant-1', enums_1.ApplicationStatus.APPROVED_LEVEL1, 'staff-1')).rejects.toThrow(common_1.BadRequestException);
        expect(query).toHaveBeenCalledTimes(1);
    });
    it('allows a fresh NEW_LEAD application to transition directly to UNDER_REVIEW (pipeline auto-entry)', async () => {
        query
            .mockResolvedValueOnce([baseApplication])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);
        const result = await service.transitionStatus('app-1', 'tenant-1', enums_1.ApplicationStatus.UNDER_REVIEW, null, 'Entered automated review');
        expect(result).toEqual({
            id: 'app-1', previousStatus: enums_1.ApplicationStatus.NEW_LEAD, newStatus: enums_1.ApplicationStatus.UNDER_REVIEW,
        });
    });
    it('rejects a transition into one of the enum\'s dead V2-vocabulary values', async () => {
        query.mockResolvedValueOnce([baseApplication]);
        await expect(service.transitionStatus('app-1', 'tenant-1', enums_1.ApplicationStatus.AI_INTERVIEW_COMPLETED, 'staff-1')).rejects.toThrow(common_1.BadRequestException);
    });
    it('sends an application_rejected notification when transitioning to rejected', async () => {
        const underReview = { ...baseApplication, current_status: enums_1.ApplicationStatus.UNDER_REVIEW };
        query
            .mockResolvedValueOnce([underReview])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([{
                first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com',
            }]);
        await service.transitionStatus('app-1', 'tenant-1', enums_1.ApplicationStatus.REJECTED, 'staff-1', 'Insufficient documentation');
        expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
            templateCode: 'application_rejected',
            recipientEmail: 'amina@example.com',
            variables: expect.objectContaining({ rejectionReason: 'Insufficient documentation' }),
        }));
    });
    it('sends an application_approved notification with the correct level on approval', async () => {
        const underReview = { ...baseApplication, current_status: enums_1.ApplicationStatus.UNDER_REVIEW };
        query
            .mockResolvedValueOnce([underReview])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([{ first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com' }]);
        await service.transitionStatus('app-1', 'tenant-1', enums_1.ApplicationStatus.APPROVED_LEVEL2, 'staff-1');
        expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
            templateCode: 'application_approved',
            variables: expect.objectContaining({ approvedLevel: 2, universityName: 'Université de Tunis' }),
        }));
    });
    it('includes the financing tier in the approval notification when provided', async () => {
        const underReview = { ...baseApplication, current_status: enums_1.ApplicationStatus.UNDER_REVIEW };
        query
            .mockResolvedValueOnce([underReview])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([{ first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com' }]);
        await service.transitionStatus('app-1', 'tenant-1', enums_1.ApplicationStatus.APPROVED_LEVEL2, 'staff-1', undefined, undefined, 'gold');
        expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
            templateCode: 'application_approved',
            variables: expect.objectContaining({ tierSuffix: ' (Gold tier)' }),
        }));
    });
    it('sends a waiting_list notification (not a rejection) when transitioned to CAPITAL_QUEUE', async () => {
        const underReview = { ...baseApplication, current_status: enums_1.ApplicationStatus.UNDER_REVIEW };
        query
            .mockResolvedValueOnce([underReview])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([{ first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com' }]);
        await service.transitionStatus('app-1', 'tenant-1', enums_1.ApplicationStatus.CAPITAL_QUEUE, 'staff-1');
        expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
            templateCode: 'waiting_list',
            recipientEmail: 'amina@example.com',
        }));
    });
    it('accepts a null changedBy for system/pipeline-driven transitions', async () => {
        const underReview = { ...baseApplication, current_status: enums_1.ApplicationStatus.UNDER_REVIEW };
        query
            .mockResolvedValueOnce([underReview])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);
        await service.transitionStatus('app-1', 'tenant-1', enums_1.ApplicationStatus.ON_HOLD, null, 'Pipeline decision', 'run-1');
        const historyInsertCall = query.mock.calls[2];
        expect(historyInsertCall[0]).toContain('INSERT INTO application_status_history');
        expect(historyInsertCall[1]).toContain(null);
    });
});
describe('ApplicationsService.createForSelf', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new applications_service_1.ApplicationsService({ query }, {}, {});
    });
    it('throws NotFoundException when no student profile is linked to this user', async () => {
        query.mockResolvedValueOnce([]);
        await expect(service.createForSelf('user-1', 'tenant-1', {})).rejects.toThrow('No student profile linked to this user');
    });
    it('rejects a visitor with no membership status at all', async () => {
        query.mockResolvedValueOnce([{ id: 'student-1', membership_status: null }]);
        await expect(service.createForSelf('user-1', 'tenant-1', {})).rejects.toThrow('Submit a Membership Request and wait for Bronze approval before requesting financing.');
    });
    it('rejects a blacklisted member with a distinct message', async () => {
        query.mockResolvedValueOnce([{ id: 'student-1', membership_status: 'blacklisted' }]);
        await expect(service.createForSelf('user-1', 'tenant-1', {})).rejects.toThrow('This account cannot submit financing requests.');
    });
    it('resolves studentId from the caller identity and never trusts a client-supplied one', async () => {
        query
            .mockResolvedValueOnce([{ id: 'student-1', membership_status: 'bronze' }])
            .mockResolvedValueOnce([{ id: 'app-1', student_id: 'student-1' }])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([]);
        await service.createForSelf('user-1', 'tenant-1', { studentId: 'someone-elses-student-id', tuitionAmount: 5000 });
        const insertCall = query.mock.calls[1];
        expect(insertCall[0]).toContain('INSERT INTO applications');
        expect(insertCall[1]).toContain('student-1');
        expect(insertCall[1]).not.toContain('someone-elses-student-id');
    });
});
describe('ApplicationsService.create — deterministic AI scoring (T-211)', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new applications_service_1.ApplicationsService({ query }, { send: jest.fn().mockResolvedValue(undefined) }, {});
    });
    it('recomputes ai_score_overall from aiReport.scores, ignoring a client-supplied aiScoreOverall', async () => {
        query
            .mockResolvedValueOnce([{ id: 'app-1', student_id: 'student-1' }])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([]);
        await service.create({
            studentId: 'student-1',
            aiScoreOverall: 999,
            aiReport: {
                scores: {
                    householdStability: 80, financialCapacity: 60, academicCommitment: 70,
                    documentationQuality: 90, aiInterviewAssessment: 50,
                },
            },
        }, 'tenant-1', 'creator-1');
        const insertCall = query.mock.calls[0];
        expect(insertCall[1]).toContain(71);
        expect(insertCall[1]).not.toContain(999);
        expect(insertCall[1]).toContain('Silver Candidate');
    });
    it('stores null ai_score_overall when the report is marked demo_mode, even with a full scores object', async () => {
        query
            .mockResolvedValueOnce([{ id: 'app-1', student_id: 'student-1' }])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([]);
        await service.create({
            studentId: 'student-1',
            aiReport: {
                demo_mode: true,
                scores: {
                    householdStability: 80, financialCapacity: 60, academicCommitment: 70,
                    documentationQuality: 90, aiInterviewAssessment: 50,
                },
            },
        }, 'tenant-1', 'creator-1');
        const insertCall = query.mock.calls[0];
        expect(insertCall[1][15]).toBeNull();
    });
    it('stores null ai_score_overall when aiReport.scores is missing or incomplete', async () => {
        query
            .mockResolvedValueOnce([{ id: 'app-1', student_id: 'student-1' }])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([]);
        await service.create({
            studentId: 'student-1',
            aiReport: { scores: { householdStability: 80 } },
        }, 'tenant-1', 'creator-1');
        const insertCall = query.mock.calls[0];
        expect(insertCall[1][15]).toBeNull();
    });
});
describe('ApplicationsService.confirmEnrollment', () => {
    let service;
    let query;
    let universitiesService;
    beforeEach(() => {
        query = jest.fn();
        universitiesService = { findMe: jest.fn() };
        service = new applications_service_1.ApplicationsService({ query }, { send: jest.fn().mockResolvedValue(undefined) }, universitiesService);
    });
    it('rejects confirming an application belonging to a different university', async () => {
        universitiesService.findMe.mockResolvedValueOnce({ id: 'uni-1' });
        query.mockResolvedValueOnce([{ id: 'app-1', university_id: 'uni-2', current_status: 'contract_signed' }]);
        await expect(service.confirmEnrollment('app-1', 'tenant-1', 'uni-user-1')).rejects.toThrow('This application does not belong to your university');
    });
    it('confirms enrollment for the calling university\'s own application', async () => {
        universitiesService.findMe.mockResolvedValueOnce({ id: 'uni-1' });
        query
            .mockResolvedValueOnce([{ id: 'app-1', university_id: 'uni-1', current_status: 'contract_signed' }])
            .mockResolvedValueOnce([{ id: 'app-1', university_id: 'uni-1', current_status: 'contract_signed' }])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);
        await service.confirmEnrollment('app-1', 'tenant-1', 'uni-user-1', 'Enrollment verified');
        const updateCall = query.mock.calls[2];
        expect(updateCall[0]).toContain('UPDATE applications SET current_status');
        expect(updateCall[1]).toContain('university_confirmed');
    });
});
describe('ApplicationsService.findOneForMyUniversity / getStatusHistoryForMyUniversity', () => {
    let service;
    let query;
    let universitiesService;
    beforeEach(() => {
        query = jest.fn();
        universitiesService = { findMe: jest.fn() };
        service = new applications_service_1.ApplicationsService({ query }, {}, universitiesService);
    });
    it('rejects an application belonging to a different university', async () => {
        universitiesService.findMe.mockResolvedValueOnce({ id: 'uni-1' });
        query.mockResolvedValueOnce([{ id: 'app-1', university_id: 'uni-2' }]);
        await expect(service.findOneForMyUniversity('uni-user-1', 'tenant-1', 'app-1')).rejects.toThrow(common_1.NotFoundException);
    });
    it('returns the application detail for the calling university\'s own application', async () => {
        universitiesService.findMe.mockResolvedValueOnce({ id: 'uni-1' });
        query.mockResolvedValueOnce([{ id: 'app-1', university_id: 'uni-1' }]);
        const result = await service.findOneForMyUniversity('uni-user-1', 'tenant-1', 'app-1');
        expect(result).toEqual({ id: 'app-1', university_id: 'uni-1' });
    });
    it('rejects status history for an application belonging to a different university', async () => {
        universitiesService.findMe.mockResolvedValueOnce({ id: 'uni-1' });
        query.mockResolvedValueOnce([{ id: 'app-1', university_id: 'uni-2' }]);
        await expect(service.getStatusHistoryForMyUniversity('uni-user-1', 'tenant-1', 'app-1')).rejects.toThrow(common_1.NotFoundException);
    });
});
describe('ApplicationsService.getStatusHistoryForMe', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new applications_service_1.ApplicationsService({ query }, {}, {});
    });
    it('rejects when the caller does not own the application', async () => {
        query.mockResolvedValueOnce([]);
        await expect(service.getStatusHistoryForMe('user-1', 'tenant-1', 'app-1')).rejects.toThrow(common_1.NotFoundException);
    });
    it('returns status history for the calling student\'s own application', async () => {
        query
            .mockResolvedValueOnce([{ id: 'app-1' }])
            .mockResolvedValueOnce([{ id: 'app-1' }])
            .mockResolvedValueOnce([{ id: 'hist-1', new_status: 'contacted' }]);
        const result = await service.getStatusHistoryForMe('user-1', 'tenant-1', 'app-1');
        expect(result).toEqual([{ id: 'hist-1', new_status: 'contacted' }]);
    });
});
//# sourceMappingURL=applications.service.spec.js.map