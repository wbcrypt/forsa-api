import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApplicationsService } from './applications.service';
import { ApplicationStatus } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';

// T-109 — STATUS_TRANSITIONS is the platform's only real enforcement of the
// application lifecycle (no DB-level state machine, no CHECK constraint on
// current_status besides the enum). A regression here would let any
// permission-holding user drive an application through an illegal
// transition (see T-107 for the related boundary-validation hardening).
describe('ApplicationsService.transitionStatus', () => {
  let service: ApplicationsService;
  let query: jest.Mock;
  let notifications: jest.Mocked<Pick<NotificationsService, 'send'>>;

  const baseApplication = {
    id: 'app-1',
    tenant_id: 'tenant-1',
    student_id: 'student-1',
    current_status: ApplicationStatus.NEW_LEAD,
    first_name: 'Amina',
    last_name: 'Trabelsi',
    email: 'amina@example.com',
    university_name: 'Université de Tunis',
    program_name: 'Génie Informatique',
  };

  beforeEach(() => {
    query = jest.fn();
    notifications = { send: jest.fn().mockResolvedValue(undefined) };
    service = new ApplicationsService(
      { query } as unknown as DataSource,
      notifications as unknown as NotificationsService,
    );
  });

  it('allows a legal transition and records status history', async () => {
    query
      .mockResolvedValueOnce([baseApplication]) // findOne (inside transitionStatus)
      .mockResolvedValueOnce(undefined)          // UPDATE applications
      .mockResolvedValueOnce(undefined)          // INSERT application_status_history
      .mockResolvedValueOnce(undefined);         // INSERT audit_logs

    const result = await service.transitionStatus(
      'app-1', 'tenant-1', ApplicationStatus.CONTACTED, 'staff-1', 'Called the student',
    );

    expect(result).toEqual({
      id: 'app-1', previousStatus: ApplicationStatus.NEW_LEAD, newStatus: ApplicationStatus.CONTACTED,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE applications SET current_status'),
      ['app-1', 'tenant-1', ApplicationStatus.CONTACTED],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO application_status_history'),
      ['app-1', ApplicationStatus.NEW_LEAD, ApplicationStatus.CONTACTED, 'staff-1', null, 'Called the student'],
    );
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('rejects an illegal transition without writing anything', async () => {
    query.mockResolvedValueOnce([baseApplication]); // findOne only

    await expect(
      service.transitionStatus('app-1', 'tenant-1', ApplicationStatus.APPROVED_LEVEL1, 'staff-1'),
    ).rejects.toThrow(BadRequestException);

    // Only the findOne SELECT should have run — no UPDATE/INSERT for a
    // rejected transition.
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects a transition into one of the enum\'s dead V2-vocabulary values', async () => {
    query.mockResolvedValueOnce([baseApplication]);

    // 'ai_interview_completed' is a real ApplicationStatus enum member but
    // is not a reachable target from any state in STATUS_TRANSITIONS — this
    // is exactly what ApplicationWorkflowPage (forsa-dashboard) sends today.
    await expect(
      service.transitionStatus('app-1', 'tenant-1', ApplicationStatus.AI_INTERVIEW_COMPLETED, 'staff-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('sends an application_rejected notification when transitioning to rejected', async () => {
    const underReview = { ...baseApplication, current_status: ApplicationStatus.UNDER_REVIEW };
    query
      .mockResolvedValueOnce([underReview])       // findOne
      .mockResolvedValueOnce(undefined)            // UPDATE
      .mockResolvedValueOnce(undefined)            // INSERT history
      .mockResolvedValueOnce(undefined)            // INSERT audit_logs
      .mockResolvedValueOnce([{                    // notifyStudent's student lookup
        first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com',
      }]);

    await service.transitionStatus(
      'app-1', 'tenant-1', ApplicationStatus.REJECTED, 'staff-1', 'Insufficient documentation',
    );

    expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
      templateCode: 'application_rejected',
      recipientEmail: 'amina@example.com',
      variables: expect.objectContaining({ rejectionReason: 'Insufficient documentation' }),
    }));
  });

  it('sends an application_approved notification with the correct level on approval', async () => {
    const underReview = { ...baseApplication, current_status: ApplicationStatus.UNDER_REVIEW };
    query
      .mockResolvedValueOnce([underReview])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com' }]);

    await service.transitionStatus('app-1', 'tenant-1', ApplicationStatus.APPROVED_LEVEL2, 'staff-1');

    expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
      templateCode: 'application_approved',
      variables: expect.objectContaining({ approvedLevel: 2, universityName: 'Université de Tunis' }),
    }));
  });
});
