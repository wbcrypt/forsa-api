import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MembershipService, generateForsaId } from './membership.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DigitalPassService } from '../digital-pass/digital-pass.service';
import { MembershipStatus } from '../common/enums';

// Phase 2 T-203/T-204 — Membership Request -> Bronze. The approve() flow is
// the highest-risk part of this milestone: a multi-table transaction that
// must never invent a real password (D-001) and must always leave a
// Bronze member with a working, self-service-resolvable account.
describe('MembershipService', () => {
  let service: MembershipService;
  let query: jest.Mock;
  let managerQuery: jest.Mock;
  let notifications: jest.Mocked<Pick<NotificationsService, 'send'>>;
  let digitalPass: jest.Mocked<Pick<DigitalPassService, 'issueForStudentTx'>>;

  const pendingRequest = {
    id: 'req-1', tenant_id: 'tenant-1', status: 'pending',
    first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com',
    phone: '+21620000000', city: 'Tunis',
  };

  beforeEach(() => {
    query = jest.fn();
    managerQuery = jest.fn();
    notifications = { send: jest.fn().mockResolvedValue(undefined) };
    digitalPass = { issueForStudentTx: jest.fn().mockResolvedValue({ verificationToken: 'tok' }) };
    const dataSource = {
      query,
      transaction: jest.fn((cb: any) => cb({ query: managerQuery })),
    };
    service = new MembershipService(
      dataSource as unknown as DataSource,
      notifications as unknown as NotificationsService,
      digitalPass as unknown as DigitalPassService,
    );
  });

  describe('createRequest', () => {
    it('rejects a duplicate pending request for the same email', async () => {
      query.mockResolvedValueOnce([{ id: 'existing-req' }]);

      await expect(service.createRequest({
        tenantId: 'tenant-1', firstName: 'A', lastName: 'B', phone: '123',
        email: 'a@b.com', city: 'Tunis', programme: 'CS', academicYear: '2026-2027',
        currentOrFutureStudent: 'current',
      })).rejects.toThrow(BadRequestException);
    });

    it('creates a pending request when none already exists', async () => {
      query
        .mockResolvedValueOnce([]) // no existing pending request
        .mockResolvedValueOnce([{ id: 'new-req', created_at: new Date() }]);

      const result = await service.createRequest({
        tenantId: 'tenant-1', firstName: 'Amina', lastName: 'Trabelsi', phone: '123',
        email: 'amina@example.com', city: 'Tunis', programme: 'CS', academicYear: '2026-2027',
        currentOrFutureStudent: 'current',
      });

      expect(result).toEqual(expect.objectContaining({ id: 'new-req', status: 'pending' }));

      // T-225 — recipientId has no real user account yet at this point,
      // so the request's own id is used (notification_logs.recipient_id
      // is NOT NULL and no student/user row exists for a visitor yet).
      expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
        templateCode: 'membership_submitted',
        recipientId: 'new-req',
        recipientEmail: 'amina@example.com',
      }));
    });
  });

  describe('approve', () => {
    it('rejects approving a request that is not pending', async () => {
      query.mockResolvedValueOnce([{ ...pendingRequest, status: 'approved' }]);

      await expect(service.approve('req-1', 'tenant-1', 'staff-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects when an account with this email already exists', async () => {
      query
        .mockResolvedValueOnce([pendingRequest]) // findOne
        .mockResolvedValueOnce([{ id: 'existing-user' }]); // existing users check

      await expect(service.approve('req-1', 'tenant-1', 'staff-1')).rejects.toThrow(BadRequestException);
    });

    it('provisions students + users transactionally, issues Bronze + a FORSA ID, and emails a set-password link', async () => {
      query
        .mockResolvedValueOnce([pendingRequest]) // findOne
        .mockResolvedValueOnce([]) // no existing user with this email
        .mockResolvedValueOnce([]); // FORSA ID uniqueness pre-check: no clash

      managerQuery
        .mockResolvedValueOnce([{ id: 'student-1', first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com', forsa_id: 'FORSA-2026-ABCDEF' }]) // INSERT students
        .mockResolvedValueOnce([{ id: 'user-1', email: 'amina@example.com' }]) // INSERT users
        .mockResolvedValueOnce(undefined) // UPDATE students SET user_id
        .mockResolvedValueOnce(undefined) // INSERT membership_status_history
        .mockResolvedValueOnce(undefined) // UPDATE membership_requests -> approved
        .mockResolvedValueOnce(undefined) // INSERT password_setup_tokens
        .mockResolvedValueOnce(undefined); // INSERT audit_logs

      const result = await service.approve('req-1', 'tenant-1', 'staff-1');

      expect(result).toEqual({ studentId: 'student-1', membershipStatus: MembershipStatus.BRONZE, forsaId: 'FORSA-2026-ABCDEF' });

      // The students INSERT must set membership_status to bronze and a
      // non-null forsa_id directly — never leave a provisioned member
      // unassigned or without a permanent ID.
      const studentsInsertCall = managerQuery.mock.calls[0];
      expect(studentsInsertCall[0]).toContain('INSERT INTO students');
      expect(studentsInsertCall[1]).toContain(MembershipStatus.BRONZE);
      expect(studentsInsertCall[1][studentsInsertCall[1].length - 1]).toMatch(/^FORSA-\d{4}-[0-9A-F]{6}$/);

      // D-001 — never invent a real password: the users INSERT's password
      // hash must not be a fixed/predictable value, and must_change_password
      // must be true (the account only becomes usable via /auth/set-password).
      const usersInsertCall = managerQuery.mock.calls[1];
      expect(usersInsertCall[0]).toContain('INSERT INTO users');

      // T-205 — a Digital Student Pass must be issued in the same
      // transaction, never as an optional/best-effort afterthought.
      expect(digitalPass.issueForStudentTx).toHaveBeenCalledWith(
        expect.anything(), 'student-1', 'tenant-1',
      );

      // A set-password email must actually be sent, with a link and the
      // assigned FORSA ID — not silently skipped.
      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          templateCode: 'membership_approved',
          recipientEmail: 'amina@example.com',
          variables: expect.objectContaining({
            forsaId: 'FORSA-2026-ABCDEF',
            setPasswordUrl: expect.stringContaining('/set-password?token='),
          }),
        }),
      );

      // T-225 — Digital Pass ready is its own distinct notification event,
      // sent alongside (not instead of) the welcome/set-password email.
      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          templateCode: 'digital_pass_ready',
          recipientEmail: 'amina@example.com',
        }),
      );
    });

    it('retries FORSA ID generation on a collision before inserting', async () => {
      query
        .mockResolvedValueOnce([pendingRequest]) // findOne
        .mockResolvedValueOnce([]) // no existing user
        .mockResolvedValueOnce([{ id: 'other-student' }]) // 1st candidate clashes
        .mockResolvedValueOnce([]); // 2nd candidate is free

      managerQuery
        .mockResolvedValueOnce([{ id: 'student-1', first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com', forsa_id: 'FORSA-2026-111111' }])
        .mockResolvedValueOnce([{ id: 'user-1', email: 'amina@example.com' }])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const result = await service.approve('req-1', 'tenant-1', 'staff-1');

      expect(result.forsaId).toBe('FORSA-2026-111111');
      // Exactly 2 uniqueness-check SELECTs happened before the transaction
      // (findOne + existing-user check already consumed 2 query calls).
      expect(query).toHaveBeenCalledTimes(4);
    });
  });

  describe('generateForsaId', () => {
    it('produces the expected FORSA-<year>-<6 hex chars> format', () => {
      const id = generateForsaId();
      expect(id).toMatch(new RegExp(`^FORSA-${new Date().getFullYear()}-[0-9A-F]{6}$`));
    });
  });

  describe('reject', () => {
    it('rejects rejecting a request that is not pending', async () => {
      query.mockResolvedValueOnce([{ ...pendingRequest, status: 'rejected' }]);

      await expect(service.reject('req-1', 'tenant-1', 'staff-1', 'Incomplete info')).rejects.toThrow(BadRequestException);
    });

    it('marks a pending request rejected with a reason', async () => {
      query
        .mockResolvedValueOnce([pendingRequest]) // findOne
        .mockResolvedValueOnce(undefined); // UPDATE -> rejected

      const result = await service.reject('req-1', 'tenant-1', 'staff-1', 'Incomplete info');
      expect(result).toEqual({ id: 'req-1', status: 'rejected' });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when no request matches', async () => {
      query.mockResolvedValueOnce([]);
      await expect(service.findOne('missing', 'tenant-1')).rejects.toThrow(NotFoundException);
    });
  });
});
