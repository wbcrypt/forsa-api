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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var KonnectService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KonnectService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const axios_1 = __importDefault(require("axios"));
let KonnectService = KonnectService_1 = class KonnectService {
    constructor(config, dataSource) {
        this.config = config;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(KonnectService_1.name);
        this.apiKey = this.config.get('konnect.apiKey') || '';
        this.walletId = this.config.get('konnect.walletId') || '';
        this.baseUrl = this.config.get('konnect.baseUrl') || 'https://api.preprod.konnect.network/api/v2';
        this.webhookSecret = this.config.get('konnect.webhookSecret') || '';
        this.appName = this.config.get('konnect.appName') || 'FORSA';
        this.returnUrl = this.config.get('konnect.returnUrl') || 'https://student.forsa.tn/payments';
    }
    get isConfigured() {
        return !!this.apiKey && !!this.walletId;
    }
    async initiatePayment(params) {
        if (!this.isConfigured) {
            throw new common_1.BadRequestException('Konnect is not configured. Contact FORSA support.');
        }
        const amountMillimes = Math.round(params.amount * 1000);
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/payments/init-payment`, {
                receiverWalletId: this.walletId,
                token: params.currency || 'TND',
                amount: amountMillimes,
                type: 'immediate',
                description: `FORSA — ${params.paymentReference}`,
                acceptedPaymentMethods: ['wallet', 'bank_card', 'e-DINAR'],
                lifespan: 30,
                checkoutForm: true,
                addPaymentFeesToAmount: false,
                firstName: params.studentName.split(' ')[0],
                lastName: params.studentName.split(' ').slice(1).join(' ') || params.studentName,
                email: params.studentEmail,
                orderId: params.paymentReference,
                webhook: `${this.config.get('app.url') || 'https://api.forsa.tn'}/api/v1/payments/konnect-webhook`,
                successUrl: `${this.returnUrl}?status=success&ref=${params.paymentReference}`,
                failUrl: `${this.returnUrl}?status=failed&ref=${params.paymentReference}`,
                theme: 'light',
                silentWebhook: true,
            }, {
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            });
            const { payUrl, paymentRef } = response.data;
            await this.dataSource.query(`INSERT INTO payments (
           tenant_id, installment_id, student_id, amount, currency,
           payment_method, reference_number, payment_date, status, notes
         ) VALUES ($1, $2, $3, $4, 'TND', 'konnect', $5, CURRENT_DATE, 'konnect_pending', $6)
         ON CONFLICT DO NOTHING`, [
                params.tenantId, params.installmentId, params.studentId,
                params.amount, params.paymentReference,
                `Konnect payment initiated. Konnect ref: ${paymentRef}`,
            ]);
            this.logger.log(`Konnect payment initiated for ${params.paymentReference} — ${params.amount} TND`);
            return {
                payUrl,
                paymentRef,
                amount: params.amount,
                reference: params.paymentReference,
            };
        }
        catch (err) {
            this.logger.error(`Konnect initiation failed: ${err.message}`, err.response?.data);
            throw new common_1.BadRequestException(err.response?.data?.message || 'Failed to initiate Konnect payment. Please try again or use bank transfer.');
        }
    }
    async processWebhook(payload, signature) {
        if (this.webhookSecret && signature) {
            const expectedSig = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(JSON.stringify(payload))
                .digest('hex');
            const sigBuffer = Buffer.from(signature.replace('sha256=', ''), 'hex');
            const expectedBuffer = Buffer.from(expectedSig, 'hex');
            if (sigBuffer.length !== expectedBuffer.length ||
                !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
                this.logger.warn('Konnect webhook: invalid signature — rejected');
                throw new common_1.UnauthorizedException('Invalid webhook signature');
            }
        }
        else if (this.webhookSecret && !signature) {
            this.logger.warn('Konnect webhook: signature expected but not provided');
            throw new common_1.UnauthorizedException('Webhook signature required');
        }
        const { payment_ref, order_id, status } = payload;
        if (!order_id || !payment_ref) {
            this.logger.warn('Konnect webhook: missing order_id or payment_ref');
            return { received: true };
        }
        if (status !== 'paid') {
            this.logger.log(`Konnect webhook: payment ${order_id} status = ${status} (not paid)`);
            return { received: true };
        }
        let verified = false;
        try {
            const check = await axios_1.default.get(`${this.baseUrl}/payments/${payment_ref}`, { headers: { 'x-api-key': this.apiKey }, timeout: 10000 });
            verified = check.data?.payment?.status === 'paid';
        }
        catch (err) {
            this.logger.error(`Konnect verification failed: ${err.message}`);
            return { received: true };
        }
        if (!verified) {
            this.logger.warn(`Konnect webhook: payment ${order_id} could not be verified`);
            return { received: true };
        }
        const [payment] = await this.dataSource.query(`SELECT p.*, i.amount AS installment_amount, i.sequence_number,
              i.grace_due_date, ps.application_id, ps.tenant_id AS sched_tenant,
              a.student_id
       FROM payments p
       JOIN installments i ON i.id = p.installment_id
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       JOIN applications a ON a.id = ps.application_id
       WHERE p.reference_number = $1 AND p.status IN ('konnect_pending', 'receipt_uploaded')
       LIMIT 1`, [order_id]);
        if (!payment) {
            this.logger.warn(`Konnect webhook: no pending payment found for reference ${order_id}`);
            return { received: true };
        }
        await this.dataSource.query(`UPDATE payments
       SET status = 'verified',
           verified_at = NOW(),
           verification_notes = $2,
           notes = COALESCE(notes, '') || ' | Konnect auto-verified: ' || $3
       WHERE id = $1`, [payment.id, `Auto-verified via Konnect. Payment ref: ${payment_ref}`, payment_ref]);
        await this.dataSource.query(`UPDATE installments
       SET status = 'paid', amount_paid = amount, paid_at = NOW()
       WHERE id = $1`, [payment.installment_id]);
        await this.dataSource.query(`INSERT INTO financial_ledger (
         tenant_id, entry_type, debit_account, credit_account,
         amount, currency, reference_type, reference_id, description, created_at
       ) VALUES ($1, 'payment', 'bank', 'student_receivable', $2, 'TND', 'payment', $3, $4, NOW())`, [
            payment.sched_tenant, payment.amount, payment.id,
            `Konnect auto-payment for installment #${payment.sequence_number}`,
        ]);
        this.logger.log(`✅ Konnect payment auto-verified: ${order_id} — installment #${payment.sequence_number}`);
        return { received: true, verified: true, installmentId: payment.installment_id };
    }
};
exports.KonnectService = KonnectService;
exports.KonnectService = KonnectService = KonnectService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_2.DataSource])
], KonnectService);
//# sourceMappingURL=konnect.service.js.map