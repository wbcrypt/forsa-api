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

// T-207 — the student portal's actual entry point into the Financing
// Request flow. Locks down two things that used to be silently broken:
// (1) a self-registered student (who holds zero role/permission grants
// today) can now reach this without the staff-only application.create
// permission, and (2) it's gated on active Bronze+ membership per D-004 —
// a Visitor/non-member/blacklisted account cannot reach financing.
describe('ApplicationsService.createForSelf', () => {
  let service: ApplicationsService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    service = new ApplicationsService(
      { query } as unknown as DataSource,
      {} as unknown as NotificationsService,
    );
  });

  it('throws NotFoundException when no student profile is linked to this user', async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.createForSelf('user-1', 'tenant-1', {})).rejects.toThrow('No student profile linked to this user');
  });

  it('rejects a visitor with no membership status at all', async () => {
    query.mockResolvedValueOnce([{ id: 'student-1', membership_status: null }]);
    await expect(service.createForSelf('user-1', 'tenant-1', {})).rejects.toThrow(
      'Submit a Membership Request and wait for Bronze approval before requesting financing.',
    );
  });

  it('rejects a blacklisted member with a distinct message', async () => {
    query.mockResolvedValueOnce([{ id: 'student-1', membership_status: 'blacklisted' }]);
    await expect(service.createForSelf('user-1', 'tenant-1', {})).rejects.toThrow(
      'This account cannot submit financing requests.',
    );
  });

  it('resolves studentId from the caller identity and never trusts a client-supplied one', async () => {
    query
      .mockResolvedValueOnce([{ id: 'student-1', membership_status: 'bronze' }]) // membership check
      .mockResolvedValueOnce([{ id: 'app-1', student_id: 'student-1' }]) // INSERT applications
      .mockResolvedValueOnce(undefined) // INSERT application_status_history
      .mockResolvedValueOnce(undefined) // audit
      .mockResolvedValueOnce([]); // notifyStudent's student lookup

    // A malicious/confused client-supplied studentId in the body must be
    // ignored — the resolved identity always wins.
    await service.createForSelf('user-1', 'tenant-1', { studentId: 'someone-elses-student-id', tuitionAmount: 5000 });

    const insertCall = query.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO applications');
    expect(insertCall[1]).toContain('student-1');
    expect(insertCall[1]).not.toContain('someone-elses-student-id');
  });
});
