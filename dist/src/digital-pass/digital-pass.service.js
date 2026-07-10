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
var DigitalPassService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigitalPassService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const QRCode = __importStar(require("qrcode"));
const encryption_util_1 = require("../common/utils/encryption.util");
let DigitalPassService = DigitalPassService_1 = class DigitalPassService {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(DigitalPassService_1.name);
    }
    async issueForStudentTx(manager, studentId, tenantId) {
        const verificationToken = (0, encryption_util_1.generateSecureToken)(24);
        await manager.query(`INSERT INTO digital_student_passes (student_id, tenant_id, verification_token, status)
       VALUES ($1,$2,$3,'active')`, [studentId, tenantId, verificationToken]);
        return { verificationToken };
    }
    async verifyByToken(token) {
        const [pass] = await this.dataSource.query(`SELECT
         dsp.status AS pass_status, dsp.issued_at,
         s.first_name, s.last_name, s.forsa_id, s.membership_status, s.member_since,
         u.name AS university_name, mr.academic_year
       FROM digital_student_passes dsp
       JOIN students s ON s.id = dsp.student_id
       LEFT JOIN membership_requests mr ON mr.provisioned_student_id = s.id
       LEFT JOIN universities u ON u.id = mr.university_id
       WHERE dsp.verification_token = $1`, [token]);
        if (!pass)
            throw new common_1.NotFoundException('This pass does not exist or the link is invalid');
        return {
            valid: pass.pass_status === 'active' && pass.membership_status !== 'blacklisted',
            passStatus: pass.pass_status,
            studentName: `${pass.first_name} ${pass.last_name}`,
            forsaId: pass.forsa_id,
            membershipStatus: pass.membership_status,
            memberSince: pass.member_since,
            university: pass.university_name,
            academicYear: pass.academic_year,
        };
    }
    async findMyPass(userId, tenantId) {
        const [pass] = await this.dataSource.query(`SELECT dsp.*, s.first_name, s.last_name, s.forsa_id, s.membership_status, s.member_since
       FROM digital_student_passes dsp
       JOIN students s ON s.id = dsp.student_id
       WHERE s.user_id = $1 AND dsp.tenant_id = $2`, [userId, tenantId]);
        if (!pass)
            throw new common_1.NotFoundException('No Digital Student Pass has been issued yet');
        const verifyUrl = `${process.env.APP_URL || 'https://api.forsa.tn'}/api/v1/pass/verify/${pass.verification_token}`;
        const qrCode = await QRCode.toDataURL(verifyUrl);
        return { ...pass, qrCode };
    }
    async findAll(tenantId) {
        return this.dataSource.query(`SELECT dsp.id, dsp.status, dsp.issued_at, dsp.revoked_at, dsp.revoked_reason,
              s.id AS student_id, s.first_name, s.last_name, s.forsa_id, s.membership_status
       FROM digital_student_passes dsp
       JOIN students s ON s.id = dsp.student_id
       WHERE dsp.tenant_id = $1
       ORDER BY dsp.issued_at DESC`, [tenantId]);
    }
    async revoke(id, tenantId, revokedBy, reason) {
        const [pass] = await this.dataSource.query(`SELECT id, status FROM digital_student_passes WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
        if (!pass)
            throw new common_1.NotFoundException('Digital Student Pass not found');
        if (pass.status === 'revoked')
            throw new common_1.BadRequestException('This pass is already revoked');
        await this.dataSource.query(`UPDATE digital_student_passes
       SET status = 'revoked', revoked_at = NOW(), revoked_by = $2, revoked_reason = $3
       WHERE id = $1`, [id, revokedBy, reason]);
        return { id, status: 'revoked' };
    }
};
exports.DigitalPassService = DigitalPassService;
exports.DigitalPassService = DigitalPassService = DigitalPassService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], DigitalPassService);
//# sourceMappingURL=digital-pass.service.js.map