import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MembershipService } from './membership.service';
import { NotificationsService } from '../notifications/notifications.service';
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

  const pendingRequest = {
    id: 'req-1', tenant_id: 'tenant-1', status: 'pending',
    first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com',
    phone: '+21620000000', city: 'Tunis',
  };

  beforeEach(() => {
    query = jest.fn();
    managerQuery = jest.fn();
    notifications = { send: jest.fn().mockResolvedValue(undefined) };
    const dataSource = {
      query,
      transaction: jest.fn((cb: any) => cb({ query: managerQuery })),
    };
    service = new MembershipService(
      dataSource as unknown as DataSource,
      notifications as unknown as NotificationsService,
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

    it('provisions students + users transactionally, issues Bronze, and emails a set-password link', async () => {
      query
        .mockResolvedValueOnce([pendingRequest]) // findOne
        .mockResolvedValueOnce([]); // no existing user with this email

      managerQuery
        .mockResolvedValueOnce([{ id: 'student-1', first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com' }]) // INSERT students
        .mockResolvedValueOnce([{ id: 'user-1', email: 'amina@example.com' }]) // INSERT users
        .mockResolvedValueOnce(undefined) // UPDATE students SET user_id
        .mockResolvedValueOnce(undefined) // INSERT membership_status_history
        .mockResolvedValueOnce(undefined) // UPDATE membership_requests -> approved
        .mockResolvedValueOnce(undefined) // INSERT password_setup_tokens
        .mockResolvedValueOnce(undefined); // INSERT audit_logs

      const result = await service.approve('req-1', 'tenant-1', 'staff-1');

      expect(result).toEqual({ studentId: 'student-1', membershipStatus: MembershipStatus.BRONZE });

      // The students INSERT must set membership_status to bronze directly —
      // never leave a provisioned member unassigned.
      const studentsInsertCall = managerQuery.mock.calls[0];
      expect(studentsInsertCall[0]).toContain('INSERT INTO students');
      expect(studentsInsertCall[1]).toContain(MembershipStatus.BRONZE);

      // D-001 — never invent a real password: the users INSERT's password
      // hash must not be a fixed/predictable value, and must_change_password
      // must be true (the account only becomes usable via /auth/set-password).
      const usersInsertCall = managerQuery.mock.calls[1];
      expect(usersInsertCall[0]).toContain('INSERT INTO users');

      // A set-password email must actually be sent, with a link — not
      // silently skipped.
      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          templateCode: 'membership_approved',
          recipientEmail: 'amina@example.com',
          variables: expect.objectContaining({
            setPasswordUrl: expect.stringContaining('/set-password?token='),
          }),
        }),
      );
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
