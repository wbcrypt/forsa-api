"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = __importStar(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const common_1 = require("@nestjs/common");
const konnect_service_1 = require("./konnect.service");
jest.mock('axios');
describe('KonnectService.processWebhook — signature verification', () => {
    const webhookSecret = 'test-webhook-secret';
    const sign = (payload) => crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');
    const makeService = () => {
        const config = {
            get: (key) => (key === 'konnect.webhookSecret' ? webhookSecret : undefined),
        };
        const dataSource = { query: jest.fn().mockResolvedValue([]) };
        const ledger = { recordEntries: jest.fn().mockResolvedValue(undefined) };
        const scoreService = { recordEvent: jest.fn().mockResolvedValue(undefined) };
        return new konnect_service_1.KonnectService(config, dataSource, ledger, scoreService);
    };
    it('rejects a request with an invalid signature', async () => {
        const service = makeService();
        const payload = { order_id: 'FORSA-1', payment_ref: 'ref-1', status: 'paid' };
        await expect(service.processWebhook(payload, sign({ tampered: true })))
            .rejects.toThrow(common_1.UnauthorizedException);
    });
    it('rejects a request with no signature when a webhook secret is configured', async () => {
        const service = makeService();
        const payload = { order_id: 'FORSA-1', payment_ref: 'ref-1', status: 'paid' };
        await expect(service.processWebhook(payload, undefined)).rejects.toThrow(common_1.UnauthorizedException);
    });
    it('accepts a request with a valid signature (passes the auth boundary)', async () => {
        const service = makeService();
        const payload = { status: 'paid' };
        await expect(service.processWebhook(payload, sign(payload)))
            .resolves.toEqual({ received: true });
    });
    it('rejects a replayed signature computed over a different payload', async () => {
        const service = makeService();
        const originalPayload = { order_id: 'FORSA-1', payment_ref: 'ref-1', status: 'paid' };
        const validSignatureForOriginal = sign(originalPayload);
        const alteredPayload = { order_id: 'FORSA-1', payment_ref: 'ref-1', status: 'paid', amount: 999999 };
        await expect(service.processWebhook(alteredPayload, validSignatureForOriginal))
            .rejects.toThrow(common_1.UnauthorizedException);
    });
});
describe('KonnectService.processWebhook — ledger write on confirmed payment', () => {
    it('records a debit/credit ledger entry via LedgerService, not a raw query', async () => {
        const config = { get: () => undefined };
        const paymentRow = {
            id: 'payment-1',
            installment_id: 'inst-1',
            amount: 500,
            sequence_number: 2,
            application_id: 'app-1',
            sched_tenant: 'tenant-1',
            student_id: 'student-1',
        };
        const query = jest.fn()
            .mockResolvedValueOnce([paymentRow])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);
        const dataSource = { query };
        const ledger = { recordEntries: jest.fn().mockResolvedValue(undefined) };
        const scoreService = { recordEvent: jest.fn().mockResolvedValue(undefined) };
        axios_1.default.get.mockResolvedValue({ data: { payment: { status: 'paid' } } });
        const service = new konnect_service_1.KonnectService(config, dataSource, ledger, scoreService);
        const result = await service.processWebhook({ order_id: 'FORSA-1', payment_ref: 'ref-1', status: 'paid' }, undefined);
        expect(result).toEqual({ received: true, verified: true, installmentId: 'inst-1' });
        expect(ledger.recordEntries).toHaveBeenCalledWith('tenant-1', 'app-1', 'payment-1', expect.objectContaining({ debitAccount: 'bank', creditAccount: 'student_receivable', amount: 500 }));
        expect(query.mock.calls.some(c => String(c[0]).includes('debit_account'))).toBe(false);
    });
    it('records an on-time PAYMENT_RELIABILITY score event on confirmed payment', async () => {
        const config = { get: () => undefined };
        const paymentRow = {
            id: 'payment-1', installment_id: 'inst-1', amount: 500, sequence_number: 2,
            application_id: 'app-1', sched_tenant: 'tenant-1', student_id: 'student-1',
            grace_due_date: null,
        };
        const query = jest.fn()
            .mockResolvedValueOnce([paymentRow])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);
        const dataSource = { query };
        const ledger = { recordEntries: jest.fn().mockResolvedValue(undefined) };
        const scoreService = { recordEvent: jest.fn().mockResolvedValue(undefined) };
        axios_1.default.get.mockResolvedValue({ data: { payment: { status: 'paid' } } });
        const service = new konnect_service_1.KonnectService(config, dataSource, ledger, scoreService);
        await service.processWebhook({ order_id: 'FORSA-1', payment_ref: 'ref-1', status: 'paid' }, undefined);
        expect(scoreService.recordEvent).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 'tenant-1', studentId: 'student-1',
            eventCode: 'PAYMENT_ON_TIME', points: 15,
            referenceId: 'payment-1', referenceType: 'payment',
            recordedBy: null,
        }));
    });
});
//# sourceMappingURL=konnect.service.spec.js.map