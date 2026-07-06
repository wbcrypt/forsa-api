import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PartnersService } from './partners.service';
import { PolicyService } from '../policy/policy.service';

// T-224 discovery — forsa-partner's Dashboard/Students/Reports pages
// called GET /applications?partnerId=X, a staff-only route whose
// recognized filters never included partnerId — the parameter was
// silently ignored. Locks down the real fix: getMyApplications resolves
// the partner via the JWT identity and filters applications by that
// partner's own id server-side, never a client-supplied one.
describe('PartnersService.getMyApplications', () => {
  let service: PartnersService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    service = new PartnersService(
      { query } as unknown as DataSource,
      {} as unknown as PolicyService,
    );
  });

  it('throws NotFoundException when no partner is linked to this user', async () => {
    query.mockResolvedValueOnce([]); // findMe
    await expect(service.getMyApplications('user-1', 'tenant-1', {})).rejects.toThrow(NotFoundException);
  });

  it('resolves the partner via findMe and filters applications by that partner id only', async () => {
    query
      .mockResolvedValueOnce([{ id: 'partner-1' }]) // findMe
      .mockResolvedValueOnce([{ id: 'app-1', first_name: 'Amina' }]) // data query
      .mockResolvedValueOnce([{ count: '1' }]); // count query

    const result = await service.getMyApplications('user-1', 'tenant-1', { page: 1, limit: 20 });

    expect(result.data).toEqual([{ id: 'app-1', first_name: 'Amina' }]);
    expect(result.meta.total).toBe(1);

    const dataCall = query.mock.calls[1];
    expect(dataCall[0]).toContain('WHERE a.tenant_id = $1 AND a.partner_id = $2');
    expect(dataCall[1]).toEqual(['tenant-1', 'partner-1', 20, 0]);

    const countCall = query.mock.calls[2];
    expect(countCall[1]).toEqual(['tenant-1', 'partner-1']);
  });
});

// T-224 discovery — no PATCH route (or service method) for updating a
// partner's own profile existed at all; ProfilePage.tsx's save action
// 404'd unconditionally. Locks down the fix resolves via the JWT
// identity, never a client-supplied partner id.
describe('PartnersService.updateMe', () => {
  let service: PartnersService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    service = new PartnersService(
      { query } as unknown as DataSource,
      {} as unknown as PolicyService,
    );
  });

  it('resolves the partner via findMe and updates only that partner\'s own row', async () => {
    query
      .mockResolvedValueOnce([{ id: 'partner-1' }]) // findMe
      .mockResolvedValueOnce([{ id: 'partner-1', name: 'New Name' }]); // UPDATE ... RETURNING

    const result = await service.updateMe('user-1', 'tenant-1', { name: 'New Name' });

    expect(result).toEqual({ id: 'partner-1', name: 'New Name' });
    const updateCall = query.mock.calls[1];
    expect(updateCall[0]).toContain('WHERE id = $1 AND tenant_id = $2');
    expect(updateCall[1]).toEqual(['partner-1', 'tenant-1', 'New Name', undefined]);
  });
});

// T-224 discovery — getDashboard(':id') required the staff-only
// partner.view permission, 403'ing unconditionally for a partner-portal
// account's own dashboard. Locks down that getMyDashboard resolves the
// caller's own partner id first, never trusting a client-supplied one.
describe('PartnersService.getMyDashboard', () => {
  it('resolves the partner via findMe, then delegates to getPartnerDashboard with that id', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ id: 'partner-1' }]) // findMe
      .mockResolvedValueOnce([{ max_visible_information: 'full' }]) // agreement lookup
      .mockResolvedValueOnce([{ total_leads: 5 }]); // stats
    const service = new PartnersService(
      { query } as unknown as DataSource,
      {} as unknown as PolicyService,
    );

    const result = await service.getMyDashboard('user-1', 'tenant-1');

    expect(result).toEqual({ total_leads: 5 });
    expect(query.mock.calls[1][1]).toEqual(['partner-1', 'tenant-1']);
    expect(query.mock.calls[2][1]).toEqual(['partner-1', 'tenant-1']);
  });
});

// T-224 discovery — the staff GET /partners/commissions had no
// partner_id filter at all (WHERE pc.tenant_id = $1 only) — every
// partner's commissions leaking across the tenant, on top of 403'ing
// for any real partner-portal account. Locks down the fix filters by
// the resolved partner's own id.
describe('PartnersService.getMyCommissions', () => {
  it('resolves the partner via findMe and filters commissions by that partner id only', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ id: 'partner-1' }]) // findMe
      .mockResolvedValueOnce([{ id: 'comm-1' }]) // data
      .mockResolvedValueOnce([{ count: '1' }]); // count
    const service = new PartnersService(
      { query } as unknown as DataSource,
      {} as unknown as PolicyService,
    );

    const result = await service.getMyCommissions('user-1', 'tenant-1', { page: 1, limit: 20 });

    expect(result.data).toEqual([{ id: 'comm-1' }]);
    const dataCall = query.mock.calls[1];
    expect(dataCall[0]).toContain('WHERE pc.tenant_id = $1 AND pc.partner_id = $2');
    expect(dataCall[1]).toEqual(['tenant-1', 'partner-1', 20, 0]);
  });
});
