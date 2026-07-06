"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuarantorsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const konnect_service_1 = require("../payments/konnect.service");
const documents_service_1 = require("../documents/documents.service");
const password_util_1 = require("../common/utils/password.util");
const enums_1 = require("../common/enums");
let GuarantorsService = class GuarantorsService {
    constructor(db, konnect, documents) {
        this.db = db;
        this.konnect = konnect;
        this.documents = documents;
    }
    async registerSelf(dto) {
        (0, password_util_1.validatePasswordComplexity)(dto.password);
        const [guarantor] = await this.db.query(`SELECT id, user_id FROM guarantors WHERE tenant_id = $1 AND email = $2`, [dto.tenantId, dto.email]);
        if (!guarantor) {
            throw new common_1.NotFoundException('No guarantor record found for this email. Ask the student\'s FORSA contact to add you as a guarantor first.');
        }
        if (guarantor.user_id) {
            throw new common_1.ConflictException('This guarantor has already activated a portal account');
        }
        const existingUser = await this.db.query(`SELECT id FROM users WHERE tenant_id = $1 AND email = $2`, [dto.tenantId, dto.email]);
        if (existingUser.length) {
            throw new common_1.ConflictException('An account with this email already exists');
        }
        const passwordHash = await (0, password_util_1.hashPassword)(dto.password);
        return this.db.transaction(async (manager) => {
            const [user] = await manager.query(`INSERT INTO users
          (tenant_id, email, email_verified, password_hash, full_name, status,
           must_change_password, portal_type, guarantor_id)
         VALUES ($1,$2,false,$3,$4,$5,false,'guarantor',$6)
         RETURNING id, email`, [dto.tenantId, dto.email, passwordHash, dto.fullName, enums_1.UserStatus.PENDING_VERIFICATION, guarantor.id]);
            await manager.query(`UPDATE guarantors SET user_id = $2, portal_activated = true WHERE id = $1`, [guarantor.id, user.id]);
            await manager.query(`INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
         VALUES ($1,$2,'guarantor.self_registered','guarantors','guarantors',$3,$4,NOW())`, [dto.tenantId, user.id, guarantor.id, JSON.stringify({ email: dto.email })]).catch(() => { });
            return { guarantorId: guarantor.id, userId: user.id, email: user.email };
        });
    }
    async findLinkedStudent(userId, tenantId) {
        const [link] = await this.db.query(`SELECT
         g.id AS guarantor_id,
         s.id AS student_id,
         s.first_name, s.last_name, s.email AS student_email,
         a.id AS application_id,
         a.current_status,
         a.university_id,
         u.name AS university_name,
         p.name AS program_name,
         a.tuition_amount
       FROM guarantors g
       JOIN student_guarantors sg ON sg.guarantor_id = g.id
       JOIN students s ON s.id = sg.student_id
       JOIN applications a ON a.student_id = s.id AND a.tenant_id = $2
       LEFT JOIN universities u ON u.id = a.university_id
       LEFT JOIN programs p ON p.id = a.program_id
       WHERE g.user_id = $1 AND g.tenant_id = $2
       ORDER BY a.created_at DESC
       LIMIT 1`, [userId, tenantId]);
        return link || null;
    }
    async getLinkedStudent(userId, tenantId) {
        const link = await this.findLinkedStudent(userId, tenantId);
        if (!link)
            return { student: null, application: null, paymentSchedule: null, installments: [] };
        const [meeting] = await this.db.query(`SELECT id, scheduled_at, status FROM activation_meetings
       WHERE application_id = $1 ORDER BY created_at DESC LIMIT 1`, [link.application_id]).catch(() => [[]]);
        const [contract] = await this.db.query(`SELECT id, status, signed_at FROM contracts
       WHERE application_id = $1 ORDER BY created_at DESC LIMIT 1`, [link.application_id]).catch(() => [[]]);
        const [schedule] = await this.db.query(`SELECT ps.*, COUNT(i.id) AS total_installments,
              SUM(CASE WHEN i.status IN ('paid','verified') THEN 1 ELSE 0 END) AS paid_count
       FROM payment_schedules ps
       LEFT JOIN installments i ON i.payment_schedule_id = ps.id
       WHERE ps.application_id = $1
       GROUP BY ps.id
       LIMIT 1`, [link.application_id]).catch(() => [[]]);
        const installments = schedule ? await this.db.query(`SELECT id, sequence_number, amount, due_date, status, amount_paid, paid_at, grace_due_date
       FROM installments WHERE payment_schedule_id = $1
       ORDER BY sequence_number`, [schedule.id]).catch(() => []) : [];
        return {
            student: {
                id: link.student_id,
                first_name: link.first_name,
                last_name: link.last_name,
                email: link.student_email,
            },
            application: {
                id: link.application_id,
                current_status: link.current_status,
                university_name: link.university_name,
                program_name: link.program_name,
                tuition_amount: link.tuition_amount,
                activation_meeting: meeting || null,
                contract: contract || null,
            },
            paymentSchedule: schedule || null,
            installments,
        };
    }
    async getLinkedStudentPayments(userId, tenantId) {
        const link = await this.findLinkedStudent(userId, tenantId);
        if (!link)
            throw new common_1.NotFoundException('No linked student found');
        const [schedule] = await this.db.query(`SELECT * FROM payment_schedules WHERE application_id = $1 LIMIT 1`, [link.application_id]);
        if (!schedule)
            return { schedule: null, installments: [], application: link };
        const installments = await this.db.query(`SELECT id, sequence_number, amount, due_date, status, amount_paid, paid_at
       FROM installments WHERE payment_schedule_id = $1 ORDER BY sequence_number`, [schedule.id]);
        return { schedule, installments, application: link };
    }
    async getReceiptUploadUrl(userId, tenantId, fileName, contentType) {
        const link = await this.findLinkedStudent(userId, tenantId);
        if (!link)
            throw new common_1.NotFoundException('No linked student found');
        return this.documents.generateUploadUrl({
            tenantId,
            entityType: 'guarantor',
            entityId: link.guarantor_id,
            documentTypeCode: 'payment_receipt',
            fileName,
            contentType,
            uploadedBy: userId,
        });
    }
    async confirmReceiptUpload(userId, tenantId, documentId, fileSize, checksum) {
        const link = await this.findLinkedStudent(userId, tenantId);
        if (!link)
            throw new common_1.NotFoundException('No linked student found');
        const [doc] = await this.db.query(`SELECT id FROM documents WHERE id = $1 AND tenant_id = $2 AND entity_type = 'guarantor' AND entity_id = $3`, [documentId, tenantId, link.guarantor_id]);
        if (!doc)
            throw new common_1.ForbiddenException('Document does not belong to your guarantor account');
        return this.documents.confirmUpload(documentId, tenantId, fileSize, checksum);
    }
    async verifyReceiptDocument(receiptDocumentId, tenantId, guarantorId) {
        if (!receiptDocumentId)
            return null;
        const [doc] = await this.db.query(`SELECT id FROM documents
       WHERE id = $1 AND tenant_id = $2 AND entity_type = 'guarantor' AND entity_id = $3
         AND status = 'uploaded'`, [receiptDocumentId, tenantId, guarantorId]);
        if (!doc) {
            throw new common_1.BadRequestException('receiptDocumentId does not reference a completed upload for this guarantor');
        }
        return doc.id;
    }
    async submitReceiptOnBehalf(userId, tenantId, body) {
        const link = await this.findLinkedStudent(userId, tenantId);
        if (!link)
            throw new common_1.NotFoundException('No linked student found');
        const [installment] = await this.db.query(`SELECT i.*, ps.application_id
       FROM installments i
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       WHERE i.id = $1 AND ps.application_id = $2`, [body.installmentId, link.application_id]);
        if (!installment)
            throw new common_1.ForbiddenException('Installment does not belong to your linked student');
        const receiptDocumentId = await this.verifyReceiptDocument(body.receiptDocumentId, tenantId, link.guarantor_id);
        await this.db.query(`INSERT INTO payments (
         tenant_id, installment_id, student_id,
         payment_date, amount, bank_name, student_bank_ref,
         student_amount, receipt_filename, receipt_document_id, receipt_uploaded_at,
         status, payment_method, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), 'receipt_uploaded', 'bank_transfer', $11)
       ON CONFLICT (installment_id) WHERE status = 'receipt_uploaded'
       DO UPDATE SET
         payment_date = $4, amount = $5, bank_name = $6,
         student_bank_ref = $7, student_amount = $8,
         receipt_filename = $9, receipt_document_id = $10, receipt_uploaded_at = NOW(),
         notes = $11`, [
            tenantId, body.installmentId, link.student_id,
            body.paymentDate, body.amount,
            body.bankName || null, body.referenceNumber || null,
            body.amount, body.receiptFilename || null, receiptDocumentId,
            `Paiement effectué par le garant. ${body.notes || ''}`.trim(),
        ]);
        await this.db.query(`INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
       VALUES ($1, $2, 'guarantor.payment_receipt_submitted', 'payments', 'installment', $3, $4, NOW())`, [tenantId, userId, body.installmentId, JSON.stringify({ amount: body.amount, by: 'guarantor' })]).catch(() => { });
        return { success: true, message: 'Reçu soumis. L\'équipe finance vérifiera dans les 24h.' };
    }
    async initiateKonnectOnBehalf(userId, email, fullName, tenantId, body) {
        const link = await this.findLinkedStudent(userId, tenantId);
        if (!link)
            throw new common_1.NotFoundException('No linked student found');
        const [installment] = await this.db.query(`SELECT i.* FROM installments i
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       WHERE i.id = $1 AND ps.application_id = $2`, [body.installmentId, link.application_id]);
        if (!installment)
            throw new common_1.ForbiddenException('Installment does not belong to your linked student');
        return this.konnect.initiatePayment({
            tenantId,
            installmentId: body.installmentId,
            studentId: link.student_id,
            studentEmail: email,
            studentName: fullName || email,
            amount: body.amount,
            paymentReference: body.paymentReference,
        });
    }
    async getNotifications(userId, tenantId) {
        const link = await this.findLinkedStudent(userId, tenantId);
        if (!link)
            return { notifications: [] };
        const notifications = await this.db.query(`SELECT
         al.action, al.created_at, al.new_value,
         CASE al.action
           WHEN 'application.status_changed' THEN 'Mise à jour de la candidature'
           WHEN 'payment.verified' THEN 'Paiement confirmé'
           WHEN 'payment.rejected' THEN 'Reçu rejeté — veuillez soumettre à nouveau'
           WHEN 'activation_meeting.scheduled' THEN 'Réunion d\'activation planifiée'
           WHEN 'contract.signed' THEN 'Contrat signé'
           ELSE al.action
         END AS label
       FROM audit_logs al
       WHERE al.tenant_id = $1
         AND al.target_id IN (
           SELECT id FROM payments WHERE student_id = $2
           UNION SELECT $3
         )
       ORDER BY al.created_at DESC
       LIMIT 20`, [tenantId, link.student_id, link.application_id]).catch(() => []);
        return { notifications };
    }
};
exports.GuarantorsService = GuarantorsService;
exports.GuarantorsService = GuarantorsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        konnect_service_1.KonnectService,
        documents_service_1.DocumentsService])
], GuarantorsService);
//# sourceMappingURL=guarantors.service.js.map