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
var MembershipService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipService = void 0;
exports.generateForsaId = generateForsaId;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const date_fns_1 = require("date-fns");
const crypto = __importStar(require("crypto"));
const password_util_1 = require("../common/utils/password.util");
const encryption_util_1 = require("../common/utils/encryption.util");
const enums_1 = require("../common/enums");
const notifications_service_1 = require("../notifications/notifications.service");
const digital_pass_service_1 = require("../digital-pass/digital-pass.service");
const PASSWORD_SETUP_TOKEN_TTL_HOURS = 48;
const FORSA_ID_MAX_ATTEMPTS = 5;
const POSTGRES_UNIQUE_VIOLATION = '23505';
function generateForsaId() {
    const year = new Date().getFullYear();
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `FORSA-${year}-${suffix}`;
}
let MembershipService = MembershipService_1 = class MembershipService {
    constructor(dataSource, notifications, digitalPass) {
        this.dataSource = dataSource;
        this.notifications = notifications;
        this.digitalPass = digitalPass;
        this.logger = new common_1.Logger(MembershipService_1.name);
    }
    async createRequest(dto) {
        const existing = await this.dataSource.query(`SELECT id FROM membership_requests
       WHERE tenant_id = $1 AND email = $2 AND status = 'pending'`, [dto.tenantId, dto.email]);
        if (existing.length) {
            throw new common_1.BadRequestException('A membership request for this email is already pending review');
        }
        const [request] = await this.dataSource.query(`INSERT INTO membership_requests
        (tenant_id, first_name, last_name, phone, email, city, university_id,
         programme, academic_year, current_or_future_student, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
       RETURNING id, created_at`, [
            dto.tenantId, dto.firstName, dto.lastName, dto.phone, dto.email, dto.city,
            dto.universityId || null, dto.programme, dto.academicYear, dto.currentOrFutureStudent,
        ]);
        await this.notifications.send({
            tenantId: dto.tenantId,
            recipientId: request.id,
            recipientEmail: dto.email,
            channel: enums_1.NotificationChannel.EMAIL,
            templateCode: 'membership_submitted',
            variables: { firstName: dto.firstName },
            referenceId: request.id,
            referenceType: 'membership_request',
        }).catch(err => this.logger.error('membership_submitted notification failed', err));
        return { id: request.id, status: enums_1.MembershipRequestStatus.PENDING, createdAt: request.created_at };
    }
    async findAll(tenantId, status) {
        if (status) {
            return this.dataSource.query(`SELECT mr.*, u.name AS university_name FROM membership_requests mr
         LEFT JOIN universities u ON u.id = mr.university_id
         WHERE mr.tenant_id = $1 AND mr.status = $2
         ORDER BY mr.created_at ASC`, [tenantId, status]);
        }
        return this.dataSource.query(`SELECT mr.*, u.name AS university_name FROM membership_requests mr
       LEFT JOIN universities u ON u.id = mr.university_id
       WHERE mr.tenant_id = $1
       ORDER BY mr.created_at DESC`, [tenantId]);
    }
    async findOne(id, tenantId) {
        const [request] = await this.dataSource.query(`SELECT mr.*, u.name AS university_name FROM membership_requests mr
       LEFT JOIN universities u ON u.id = mr.university_id
       WHERE mr.id = $1 AND mr.tenant_id = $2`, [id, tenantId]);
        if (!request)
            throw new common_1.NotFoundException('Membership request not found');
        return request;
    }
    async approve(id, tenantId, approvedBy) {
        const request = await this.findOne(id, tenantId);
        if (request.status !== enums_1.MembershipRequestStatus.PENDING) {
            throw new common_1.BadRequestException(`Membership request is already ${request.status}`);
        }
        const existingUser = await this.dataSource.query(`SELECT id FROM users WHERE tenant_id = $1 AND email = $2`, [tenantId, request.email]);
        if (existingUser.length) {
            throw new common_1.BadRequestException('An account with this email already exists');
        }
        let forsaId = generateForsaId();
        for (let attempt = 1; attempt < FORSA_ID_MAX_ATTEMPTS; attempt++) {
            const [clash] = await this.dataSource.query(`SELECT id FROM students WHERE forsa_id = $1`, [forsaId]);
            if (!clash)
                break;
            forsaId = generateForsaId();
        }
        const result = await this.dataSource.transaction(async (manager) => {
            const [student] = await manager.query(`INSERT INTO students
          (tenant_id, first_name, last_name, email, phone_primary, city,
           status, membership_status, member_since, forsa_id)
         VALUES ($1,$2,$3,$4,$5,$6,'lead',$7,CURRENT_DATE,$8)
         RETURNING id, first_name, last_name, email, forsa_id`, [
                tenantId, request.first_name, request.last_name, request.email,
                request.phone, request.city, enums_1.MembershipStatus.BRONZE, forsaId,
            ]);
            const placeholderHash = await (0, password_util_1.hashPassword)((0, encryption_util_1.generateSecureToken)(32));
            const [user] = await manager.query(`INSERT INTO users
          (tenant_id, email, email_verified, password_hash, full_name, status,
           must_change_password, portal_type, student_id_linked)
         VALUES ($1,$2,false,$3,$4,$5,true,'student',$6)
         RETURNING id, email`, [
                tenantId, request.email, placeholderHash,
                `${request.first_name} ${request.last_name}`.trim(),
                enums_1.UserStatus.PENDING_VERIFICATION, student.id,
            ]);
            await manager.query(`UPDATE students SET user_id = $2 WHERE id = $1`, [student.id, user.id]);
            await this.digitalPass.issueForStudentTx(manager, student.id, tenantId);
            await manager.query(`INSERT INTO membership_status_history
          (student_id, tenant_id, previous_status, new_status, reason, changed_by)
         VALUES ($1,$2,NULL,$3,'Membership request approved',$4)`, [student.id, tenantId, enums_1.MembershipStatus.BRONZE, approvedBy]);
            await manager.query(`UPDATE membership_requests
         SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(), provisioned_student_id = $3
         WHERE id = $1`, [id, approvedBy, student.id]);
            const rawToken = (0, encryption_util_1.generateSecureToken)(32);
            const tokenHash = (0, encryption_util_1.hashToken)(rawToken);
            await manager.query(`INSERT INTO password_setup_tokens (user_id, tenant_id, token_hash, expires_at)
         VALUES ($1,$2,$3,$4)`, [user.id, tenantId, tokenHash, (0, date_fns_1.addHours)(new Date(), PASSWORD_SETUP_TOKEN_TTL_HOURS)]);
            await manager.query(`INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
         VALUES ($1,$2,'membership.approved','membership','students',$3,$4,NOW())`, [tenantId, approvedBy, student.id, JSON.stringify({ email: request.email, membershipStatus: enums_1.MembershipStatus.BRONZE })]).catch(() => { });
            return { studentId: student.id, userId: user.id, email: user.email, forsaId: student.forsa_id, rawToken };
        });
        const setPasswordUrl = `${process.env.STUDENT_PORTAL_URL || 'https://student.forsa.tn'}/set-password?token=${result.rawToken}`;
        await this.notifications.send({
            tenantId,
            recipientId: result.userId,
            recipientEmail: result.email,
            channel: enums_1.NotificationChannel.EMAIL,
            templateCode: 'membership_approved',
            variables: { studentName: request.first_name, forsaId: result.forsaId, setPasswordUrl },
            triggeredBy: approvedBy,
            referenceId: result.studentId,
            referenceType: 'student',
        }).catch(err => this.logger.error('membership_approved notification failed', err));
        await this.notifications.send({
            tenantId,
            recipientId: result.userId,
            recipientEmail: result.email,
            channel: enums_1.NotificationChannel.EMAIL,
            templateCode: 'digital_pass_ready',
            variables: { studentName: request.first_name },
            triggeredBy: approvedBy,
            referenceId: result.studentId,
            referenceType: 'student',
        }).catch(err => this.logger.error('digital_pass_ready notification failed', err));
        return { studentId: result.studentId, membershipStatus: enums_1.MembershipStatus.BRONZE, forsaId: result.forsaId };
    }
    async reject(id, tenantId, rejectedBy, reason) {
        const request = await this.findOne(id, tenantId);
        if (request.status !== enums_1.MembershipRequestStatus.PENDING) {
            throw new common_1.BadRequestException(`Membership request is already ${request.status}`);
        }
        await this.dataSource.query(`UPDATE membership_requests
       SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), rejection_reason = $3
       WHERE id = $1`, [id, rejectedBy, reason]);
        return { id, status: enums_1.MembershipRequestStatus.REJECTED };
    }
};
exports.MembershipService = MembershipService;
exports.MembershipService = MembershipService = MembershipService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        notifications_service_1.NotificationsService,
        digital_pass_service_1.DigitalPassService])
], MembershipService);
//# sourceMappingURL=membership.service.js.map