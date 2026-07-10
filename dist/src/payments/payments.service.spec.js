"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const payments_service_1 = require("./payments.service");
describe('PaymentsService.recordPayment', () => {
    let service;
    let query;
    let scoreService;
    let notifications;
    let ledger;
    const installmentRow = {
        id: 'inst-1',
        status: 'pending',
        amount: '500.00',
        amount_paid: '0',
        sequence_number: 3,
        application_id: 'app-1',
        tenant_id: 'tenant-1',
        student_id: 'student-1',
        grace_due_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    };
    beforeEach(() => {
        query = jest.fn();
        scoreService = { recordEvent: jest.fn().mockResolvedValue(undefined) };
        notifications = { send: jest.fn().mockResolvedValue(undefined) };
        ledger = { recordEntries: jest.fn().mockResolvedValue(undefined) };
        service = new payments_service_1.PaymentsService({ query }, {}, scoreService, {}, notifications, ledger);
    });
    it('writes a matched debit/credit ledger pair and records an on-time score event for a full payment', async () => {
        query
            .mockResolvedValueOnce([installmentRow])
            .mockResolvedValueOnce([{ id: 'payment-1' }])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([{
                first_name: 'Karim', last_name: 'Ben Ali', email: 'karim@example.com',
            }]);
        const result = await service.recordPayment({
            tenantId: 'tenant-1',
            installmentId: 'inst-1',
            amount: 500,
            currency: 'TND',
            paymentMethod: 'bank_transfer',
            referenceNumber: 'REF-001',
            paymentDate: new Date(),
            receivedBy: 'staff-1',
        });
        expect(result.newInstallmentStatus).toBe('paid');
        expect(ledger.recordEntries).toHaveBeenCalledWith('tenant-1', 'app-1', 'payment-1', expect.objectContaining({ debitAccount: 'bank', creditAccount: 'student_receivable', amount: 500 }));
        expect(scoreService.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventCode: 'PAYMENT_ON_TIME', points: 15, studentId: 'student-1' }));
        expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({ templateCode: 'payment_confirmed' }));
    });
    it('rejects recording a payment against an already-paid installment', async () => {
        query.mockResolvedValueOnce([{ ...installmentRow, status: 'paid' }]);
        await expect(service.recordPayment({
            tenantId: 'tenant-1',
            installmentId: 'inst-1',
            amount: 500,
            currency: 'TND',
            paymentMethod: 'bank_transfer',
            referenceNumber: 'REF-002',
            paymentDate: new Date(),
            receivedBy: 'staff-1',
        })).rejects.toThrow('Installment already paid');
    });
    describe('overpayment guard', () => {
        it('accepts a payment that exactly matches the remaining balance', async () => {
            query
                .mockResolvedValueOnce([installmentRow])
                .mockResolvedValueOnce([{ id: 'payment-1' }])
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce([{ first_name: 'Karim', last_name: 'Ben Ali', email: 'karim@example.com' }]);
            const result = await service.recordPayment({
                tenantId: 'tenant-1', installmentId: 'inst-1', amount: 500, currency: 'TND',
                paymentMethod: 'bank_transfer', referenceNumber: 'REF-EXACT',
                paymentDate: new Date(), receivedBy: 'staff-1',
            });
            expect(result.newInstallmentStatus).toBe('paid');
            expect(result.amountPaid).toBe(500);
        });
        it('accepts a partial payment below the remaining balance', async () => {
            query
                .mockResolvedValueOnce([installmentRow])
                .mockResolvedValueOnce([{ id: 'payment-2' }])
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined);
            const result = await service.recordPayment({
                tenantId: 'tenant-1', installmentId: 'inst-1', amount: 200, currency: 'TND',
                paymentMethod: 'bank_transfer', referenceNumber: 'REF-PARTIAL',
                paymentDate: new Date(), receivedBy: 'staff-1',
            });
            expect(result.newInstallmentStatus).toBe('partial');
            expect(result.amountPaid).toBe(200);
        });
        it('rejects a payment that exceeds the remaining balance, without writing anything', async () => {
            query.mockResolvedValueOnce([installmentRow]);
            await expect(service.recordPayment({
                tenantId: 'tenant-1', installmentId: 'inst-1', amount: 600, currency: 'TND',
                paymentMethod: 'bank_transfer', referenceNumber: 'REF-EXCESS',
                paymentDate: new Date(), receivedBy: 'staff-1',
            })).rejects.toThrow('exceeds the remaining balance');
            expect(query).toHaveBeenCalledTimes(1);
        });
        it('rejects a payment that exceeds what remains on a partially-paid installment', async () => {
            query.mockResolvedValueOnce([{ ...installmentRow, amount_paid: '300' }]);
            await expect(service.recordPayment({
                tenantId: 'tenant-1', installmentId: 'inst-1', amount: 250, currency: 'TND',
                paymentMethod: 'bank_transfer', referenceNumber: 'REF-EXCESS-2',
                paymentDate: new Date(), receivedBy: 'staff-1',
            })).rejects.toThrow('exceeds the remaining balance');
            expect(query).toHaveBeenCalledTimes(1);
        });
    });
});
describe('PaymentsService.verifyPayment — overpayment guard', () => {
    let service;
    let query;
    let scoreService;
    let notifications;
    let ledger;
    const paymentRow = {
        id: 'payment-1',
        status: 'receipt_uploaded',
        amount: '500',
        student_amount: '500',
        currency: 'TND',
        installment_id: 'inst-1',
        installment_amount: '500.00',
        amount_paid: '0',
        sequence_number: 3,
        application_id: 'app-1',
        sched_tenant: 'tenant-1',
        student_id: 'student-1',
        grace_due_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    };
    beforeEach(() => {
        query = jest.fn();
        scoreService = { recordEvent: jest.fn().mockResolvedValue(undefined) };
        notifications = { send: jest.fn().mockResolvedValue(undefined) };
        ledger = { recordEntries: jest.fn().mockResolvedValue(undefined) };
        service = new payments_service_1.PaymentsService({ query }, {}, scoreService, {}, notifications, ledger);
    });
    it('accepts a verified amount that exactly matches the remaining balance', async () => {
        query
            .mockResolvedValueOnce([paymentRow])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([{ first_name: 'Karim', last_name: 'Ben Ali', email: 'karim@example.com' }]);
        await service.verifyPayment('payment-1', 'tenant-1', 'staff-1');
        expect(ledger.recordEntries).toHaveBeenCalledWith('tenant-1', 'app-1', 'payment-1', expect.objectContaining({ amount: 500 }));
    });
    it('accepts a verified amount below the remaining balance (partial)', async () => {
        query
            .mockResolvedValueOnce([{ ...paymentRow, student_amount: '200', amount: '200' }])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);
        await service.verifyPayment('payment-1', 'tenant-1', 'staff-1');
        const updateInstallmentCall = query.mock.calls.find(c => c[0].includes('UPDATE installments'));
        expect(updateInstallmentCall[1]).toEqual(['inst-1', 200, 'partial']);
    });
    it('rejects a verified amount that exceeds the remaining balance, without mutating anything', async () => {
        query.mockResolvedValueOnce([{ ...paymentRow, amount_paid: '300' }]);
        await expect(service.verifyPayment('payment-1', 'tenant-1', 'staff-1')).rejects.toThrow('exceeds the remaining balance');
        expect(query).toHaveBeenCalledTimes(1);
    });
});
describe('PaymentsService.submitReceipt — receiptDocumentId verification', () => {
    let service;
    let query;
    const installmentRow = {
        id: 'inst-1', status: 'pending', application_id: 'app-1',
        tenant_id: 'tenant-1', student_id: 'student-1',
    };
    beforeEach(() => {
        query = jest.fn();
        service = new payments_service_1.PaymentsService({ query }, {}, {}, {}, {}, {});
    });
    const submitParams = {
        tenantId: 'tenant-1', installmentId: 'inst-1', callerUserId: 'user-1',
        paymentDate: '2026-07-01', amount: 500, receiptDocumentId: 'doc-1',
    };
    it('rejects a receiptDocumentId that does not resolve to a completed upload for this student', async () => {
        query
            .mockResolvedValueOnce([installmentRow])
            .mockResolvedValueOnce([{ id: 'student-1' }])
            .mockResolvedValueOnce([]);
        await expect(service.submitReceipt(submitParams))
            .rejects.toThrow('receiptDocumentId does not reference a completed upload for this student');
    });
    it('accepts and persists a receiptDocumentId that does belong to this student', async () => {
        query
            .mockResolvedValueOnce([installmentRow])
            .mockResolvedValueOnce([{ id: 'student-1' }])
            .mockResolvedValueOnce([{ id: 'doc-1' }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'payment-1' }]);
        const result = await service.submitReceipt(submitParams);
        expect(result).toEqual({ paymentId: 'payment-1', status: 'receipt_uploaded' });
        const insertCall = query.mock.calls.find(c => c[0].includes('INSERT INTO payments'));
        expect(insertCall[1]).toContain('doc-1');
    });
    it('proceeds normally when no receiptDocumentId is supplied (filename-only, legacy path)', async () => {
        query
            .mockResolvedValueOnce([installmentRow])
            .mockResolvedValueOnce([{ id: 'student-1' }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'payment-1' }]);
        const { receiptDocumentId: _receiptDocumentId, ...withoutDoc } = submitParams;
        const result = await service.submitReceipt(withoutDoc);
        expect(result).toEqual({ paymentId: 'payment-1', status: 'receipt_uploaded' });
        expect(query).toHaveBeenCalledTimes(4);
    });
    it('rejects when the caller does not own the installment', async () => {
        query
            .mockResolvedValueOnce([installmentRow])
            .mockResolvedValueOnce([]);
        await expect(service.submitReceipt({ ...submitParams, callerUserId: 'someone-elses-user-id' })).rejects.toThrow(common_1.NotFoundException);
    });
});
describe('PaymentsService.verifyMyInstallmentOwnership', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new payments_service_1.PaymentsService({ query }, {}, {}, {}, {}, {});
    });
    it('returns the students.id when the caller owns the installment', async () => {
        query.mockResolvedValueOnce([{ student_id: 'student-1' }]);
        const result = await service.verifyMyInstallmentOwnership('user-1', 'inst-1', 'tenant-1');
        expect(result).toBe('student-1');
    });
    it('rejects when the caller does not own the installment (or it does not exist)', async () => {
        query.mockResolvedValueOnce([]);
        await expect(service.verifyMyInstallmentOwnership('user-1', 'inst-1', 'tenant-1')).rejects.toThrow(common_1.NotFoundException);
    });
});
describe('PaymentsService.findScheduleForMyUniversityApplication', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new payments_service_1.PaymentsService({ query }, {}, {}, {}, {}, {});
    });
    it('rejects when the application does not belong to the caller\'s university', async () => {
        query.mockResolvedValueOnce([]);
        await expect(service.findScheduleForMyUniversityApplication('uni-user-1', 'app-1', 'tenant-1')).rejects.toThrow(common_1.NotFoundException);
    });
    it('returns the schedule for the caller\'s own university application', async () => {
        query
            .mockResolvedValueOnce([{ id: 'app-1' }])
            .mockResolvedValueOnce([{ id: 'sched-1' }]);
        const result = await service.findScheduleForMyUniversityApplication('uni-user-1', 'app-1', 'tenant-1');
        expect(result).toEqual({ id: 'sched-1' });
    });
});
//# sourceMappingURL=payments.service.spec.js.map