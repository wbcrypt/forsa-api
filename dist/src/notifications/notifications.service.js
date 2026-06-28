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
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const nodemailer = __importStar(require("nodemailer"));
const enums_1 = require("../common/enums");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    constructor(dataSource, configService) {
        this.dataSource = dataSource;
        this.configService = configService;
        this.logger = new common_1.Logger(NotificationsService_1.name);
        this.mailer = nodemailer.createTransport({
            host: configService.get('email.host'),
            port: configService.get('email.port'),
            secure: configService.get('email.secure'),
            auth: {
                user: configService.get('email.user'),
                pass: configService.get('email.password'),
            },
        });
    }
    async send(params) {
        const [template] = await this.dataSource.query(`SELECT * FROM notification_templates
       WHERE code = $1 AND channel = $2 AND is_active = true`, [params.templateCode, params.channel]);
        if (!template) {
            this.logger.warn(`No active template: ${params.templateCode} / ${params.channel}`);
            return;
        }
        const rendered = this.renderTemplate(template.body_template, params.variables);
        const subject = this.renderTemplate(template.subject_template || '', params.variables);
        let status = 'pending';
        let errorMessage;
        try {
            if (params.channel === enums_1.NotificationChannel.EMAIL) {
                await this.sendEmail(params.recipientEmail, subject, rendered);
                status = 'sent';
            }
            else if (params.channel === enums_1.NotificationChannel.SMS) {
                await this.sendSms(params.recipientPhone, rendered);
                status = 'sent';
            }
            else if (params.channel === enums_1.NotificationChannel.IN_APP) {
                status = 'delivered';
            }
        }
        catch (err) {
            status = 'failed';
            errorMessage = err.message;
            this.logger.error(`Notification send failed: ${params.templateCode}`, err);
        }
        await this.dataSource.query(`INSERT INTO notification_logs
        (tenant_id, template_id, recipient_id, recipient_email, recipient_phone,
         channel, subject, body, status, error_message, reference_id, reference_type,
         triggered_by, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
               CASE WHEN $9 = 'sent' THEN NOW() ELSE NULL END)`, [
            params.tenantId, template.id, params.recipientId,
            params.recipientEmail, params.recipientPhone,
            params.channel, subject, rendered, status, errorMessage,
            params.referenceId, params.referenceType, params.triggeredBy,
        ]).catch(err => this.logger.error('Failed to log notification', err));
    }
    async sendBulk(notifications) {
        await Promise.allSettled(notifications.map(n => this.send(n)));
    }
    async getNotificationsForUser(userId, tenantId, limit = 20) {
        return this.dataSource.query(`SELECT nl.id, nl.subject, nl.body, nl.channel, nl.status,
              nl.sent_at, nl.read_at, nl.reference_id, nl.reference_type
       FROM notification_logs nl
       WHERE nl.recipient_id = $1 AND nl.tenant_id = $2
         AND nl.channel = 'in_app'
       ORDER BY nl.created_at DESC
       LIMIT $3`, [userId, tenantId, limit]);
    }
    async markRead(notificationId, userId) {
        await this.dataSource.query(`UPDATE notification_logs SET read_at = NOW()
       WHERE id = $1 AND recipient_id = $2 AND read_at IS NULL`, [notificationId, userId]);
    }
    renderTemplate(template, variables) {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`);
    }
    async sendEmail(to, subject, body) {
        await this.mailer.sendMail({
            from: `"${this.configService.get('email.fromName')}" <${this.configService.get('email.fromEmail')}>`,
            to,
            subject,
            html: body,
        });
    }
    async sendSms(phone, body) {
        this.logger.log(`SMS to ${phone}: ${body.substring(0, 50)}...`);
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        config_1.ConfigService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map