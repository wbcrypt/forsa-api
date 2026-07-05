import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UniversitiesService } from './universities.service';

// T-223 discovery — the university portal used to collect "University ID"
// as a raw, user-typed login-form field and trust it client-side for every
// subsequent "my university" API call (the same class of bug as K-03/T-103's
// partners[0] issue, fixed in Phase 1). findMe/linkUser are the real,
// server-side identity resolution this closes — locks down that findMe
// never resolves to a university the caller isn't actually linked to.
describe('UniversitiesService — T-223 identity fix', () => {
  let service: UniversitiesService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    service = new UniversitiesService({ query } as unknown as DataSource);
  });

  describe('findMe', () => {
    it('resolves the university via the caller user_id, never a client-supplied id', async () => {
      query.mockResolvedValueOnce([{ id: 'uni-1', user_id: 'user-1', name: 'Test University' }]);

      const result = await service.findMe('user-1', 'tenant-1');

      expect(result).toEqual(expect.objectContaining({ id: 'uni-1' }));
      const call = query.mock.calls[0];
      expect(call[0]).toContain('WHERE user_id = $1 AND tenant_id = $2');
      expect(call[1]).toEqual(['user-1', 'tenant-1']);
    });

    it('throws NotFoundException when no university is linked to this user', async () => {
      query.mockResolvedValueOnce([]);
      await expect(service.findMe('user-2', 'tenant-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('linkUser', () => {
    it('throws NotFoundException for an unknown university', async () => {
      query.mockResolvedValueOnce([]);
      await expect(service.linkUser('missing-uni', 'user-1', 'tenant-1', 'staff-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for an unknown user', async () => {
      query
        .mockResolvedValueOnce([{ id: 'uni-1' }]) // university exists
        .mockResolvedValueOnce([]); // user does not
      await expect(service.linkUser('uni-1', 'missing-user', 'tenant-1', 'staff-1')).rejects.toThrow(NotFoundException);
    });

    it('links both sides of the relationship', async () => {
      query
        .mockResolvedValueOnce([{ id: 'uni-1' }])
        .mockResolvedValueOnce([{ id: 'user-1' }])
        .mockResolvedValueOnce(undefined) // UPDATE universities
        .mockResolvedValueOnce(undefined) // UPDATE users
        .mockResolvedValueOnce(undefined); // audit log

      const result = await service.linkUser('uni-1', 'user-1', 'tenant-1', 'staff-1');

      expect(result).toEqual({ id: 'uni-1', userId: 'user-1' });
      expect(query.mock.calls[2][0]).toContain('UPDATE universities SET user_id');
      expect(query.mock.calls[3][0]).toContain('UPDATE users SET university_id_linked');
    });
  });
});
