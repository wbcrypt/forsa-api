"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const partners_service_1 = require("./partners.service");
describe('PartnersService.getMyApplications', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new partners_service_1.PartnersService({ query }, {});
    });
    it('throws NotFoundException when no partner is linked to this user', async () => {
        query.mockResolvedValueOnce([]);
        await expect(service.getMyApplications('user-1', 'tenant-1', {})).rejects.toThrow(common_1.NotFoundException);
    });
    it('resolves the partner via findMe and filters applications by that partner id only', async () => {
        query
            .mockResolvedValueOnce([{ id: 'partner-1' }])
            .mockResolvedValueOnce([{ id: 'app-1', first_name: 'Amina' }])
            .mockResolvedValueOnce([{ count: '1' }]);
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
describe('PartnersService.updateMe', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new partners_service_1.PartnersService({ query }, {});
    });
    it('resolves the partner via findMe and updates only that partner\'s own row', async () => {
        query
            .mockResolvedValueOnce([{ id: 'partner-1' }])
            .mockResolvedValueOnce([{ id: 'partner-1', name: 'New Name' }]);
        const result = await service.updateMe('user-1', 'tenant-1', { name: 'New Name' });
        expect(result).toEqual({ id: 'partner-1', name: 'New Name' });
        const updateCall = query.mock.calls[1];
        expect(updateCall[0]).toContain('WHERE id = $1 AND tenant_id = $2');
        expect(updateCall[1]).toEqual(['partner-1', 'tenant-1', 'New Name', undefined]);
    });
});
describe('PartnersService.getMyDashboard', () => {
    it('resolves the partner via findMe, then delegates to getPartnerDashboard with that id', async () => {
        const query = jest.fn()
            .mockResolvedValueOnce([{ id: 'partner-1' }])
            .mockResolvedValueOnce([{ max_visible_information: 'full' }])
            .mockResolvedValueOnce([{ total_leads: 5 }]);
        const service = new partners_service_1.PartnersService({ query }, {});
        const result = await service.getMyDashboard('user-1', 'tenant-1');
        expect(result).toEqual({ total_leads: 5 });
        expect(query.mock.calls[1][1]).toEqual(['partner-1', 'tenant-1']);
        expect(query.mock.calls[2][1]).toEqual(['partner-1', 'tenant-1']);
    });
});
describe('PartnersService.getMyCommissions', () => {
    it('resolves the partner via findMe and filters commissions by that partner id only', async () => {
        const query = jest.fn()
            .mockResolvedValueOnce([{ id: 'partner-1' }])
            .mockResolvedValueOnce([{ id: 'comm-1' }])
            .mockResolvedValueOnce([{ count: '1' }]);
        const service = new partners_service_1.PartnersService({ query }, {});
        const result = await service.getMyCommissions('user-1', 'tenant-1', { page: 1, limit: 20 });
        expect(result.data).toEqual([{ id: 'comm-1' }]);
        const dataCall = query.mock.calls[1];
        expect(dataCall[0]).toContain('WHERE pc.tenant_id = $1 AND pc.partner_id = $2');
        expect(dataCall[1]).toEqual(['tenant-1', 'partner-1', 20, 0]);
    });
});
//# sourceMappingURL=partners.service.spec.js.map