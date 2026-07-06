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
var DocumentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const uuid_1 = require("uuid");
const enums_1 = require("../common/enums");
const policy_service_1 = require("../policy/policy.service");
const notifications_service_1 = require("../notifications/notifications.service");
let DocumentsService = DocumentsService_1 = class DocumentsService {
    constructor(dataSource, configService, policyService, notifications) {
        this.dataSource = dataSource;
        this.configService = configService;
        this.policyService = policyService;
        this.notifications = notifications;
        this.logger = new common_1.Logger(DocumentsService_1.name);
        this.s3 = new client_s3_1.S3Client({
            endpoint: configService.get('s3.endpoint'),
            region: configService.get('s3.region'),
            credentials: {
                accessKeyId: configService.get('s3.accessKeyId'),
                secretAccessKey: configService.get('s3.secretAccessKey'),
            },
            forcePathStyle: configService.get('s3.forcePathStyle'),
        });
        this.bucket = configService.get('s3.bucket');
        this.signedUrlExpiry = configService.get('s3.signedUrlExpiry') || 300;
    }
    async generateUploadUrl(params) {
        const [docType] = await this.dataSource.query(`SELECT * FROM document_types WHERE code = $1 AND is_active = true`, [params.documentTypeCode]);
        if (!docType)
            throw new common_1.BadRequestException(`Invalid document type: ${params.documentTypeCode}`);
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(params.contentType)) {
            throw new common_1.BadRequestException('Only PDF and image files are allowed');
        }
        const fileId = (0, uuid_1.v4)();
        const ext = this.getExtension(params.contentType);
        const s3Key = `${params.tenantId}/${params.entityType}/${params.entityId}/${params.documentTypeCode}/${fileId}${ext}`;
        const [document] = await this.dataSource.query(`INSERT INTO documents
        (tenant_id, entity_type, entity_id, document_type_code, original_filename,
         s3_key, s3_bucket, content_type, status, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'uploading',$9)
       RETURNING id`, [
            params.tenantId, params.entityType, params.entityId,
            params.documentTypeCode, params.fileName,
            s3Key, this.bucket, params.contentType, params.uploadedBy,
        ]);
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: s3Key,
            ContentType: params.contentType,
            Metadata: {
                'document-id': document.id,
                'tenant-id': params.tenantId,
                'uploaded-by': params.uploadedBy,
            },
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3, command, { expiresIn: 600 });
        const expiresAt = new Date(Date.now() + 600 * 1000);
        return { uploadUrl, documentId: document.id, s3Key, expiresAt };
    }
    async generateMyUploadUrl(callerUserId, tenantId, params) {
        const [student] = await this.dataSource.query(`SELECT id FROM students WHERE user_id = $1 AND tenant_id = $2`, [callerUserId, tenantId]);
        if (!student)
            throw new common_1.NotFoundException('No student profile linked to this user');
        return this.generateUploadUrl({
            tenantId,
            entityType: 'student',
            entityId: student.id,
            documentTypeCode: params.documentTypeCode,
            fileName: params.fileName,
            contentType: params.contentType,
            uploadedBy: callerUserId,
        });
    }
    async confirmMyUpload(callerUserId, documentId, tenantId, fileSize, checksum) {
        const [doc] = await this.dataSource.query(`SELECT uploaded_by FROM documents WHERE id = $1 AND tenant_id = $2`, [documentId, tenantId]);
        if (!doc || doc.uploaded_by !== callerUserId) {
            throw new common_1.NotFoundException('Document not found or upload not pending');
        }
        return this.confirmUpload(documentId, tenantId, fileSize, checksum);
    }
    async confirmUpload(documentId, tenantId, fileSize, checksum) {
        const [doc] = await this.dataSource.query(`SELECT * FROM documents WHERE id = $1 AND tenant_id = $2 AND status = 'uploading'`, [documentId, tenantId]);
        if (!doc)
            throw new common_1.NotFoundException('Document not found or upload not pending');
        const [docType] = await this.dataSource.query(`SELECT validity_months FROM document_types WHERE code = $1`, [doc.document_type_code]);
        const documentExpiresAt = docType?.validity_months
            ? `NOW() + INTERVAL '${parseInt(docType.validity_months, 10)} months'`
            : null;
        await this.dataSource.query(`UPDATE documents
       SET status = 'uploaded', file_size_bytes = $3, checksum_sha256 = $4, uploaded_at = NOW(),
           expires_at = ${documentExpiresAt || 'NULL'}
       WHERE id = $1 AND tenant_id = $2`, [documentId, tenantId, fileSize, checksum || null]);
        if (doc.entity_type === 'application') {
            await this.dataSource.query(`INSERT INTO application_documents
          (application_id, document_id, document_type_code, status)
         VALUES ($1,$2,$3,'uploaded')
         ON CONFLICT (application_id, document_type_code) DO UPDATE SET document_id = $2, status = 'uploaded'`, [doc.entity_id, documentId, doc.document_type_code]);
        }
        return { documentId, status: enums_1.DocumentStatus.UPLOADED };
    }
    async generateDownloadUrlForMyUniversity(documentId, tenantId, callerUserId, ipAddress) {
        const [owned] = await this.dataSource.query(`SELECT 1
       FROM application_documents ad
       JOIN applications a ON a.id = ad.application_id
       JOIN universities uni ON uni.id = a.university_id
       WHERE ad.document_id = $1 AND a.tenant_id = $2 AND uni.user_id = $3
       LIMIT 1`, [documentId, tenantId, callerUserId]);
        if (!owned)
            throw new common_1.NotFoundException('Document not found');
        return this.generateDownloadUrl(documentId, tenantId, callerUserId, ipAddress);
    }
    async generateDownloadUrl(documentId, tenantId, requestedBy, ipAddress) {
        const [doc] = await this.dataSource.query(`SELECT * FROM documents WHERE id = $1 AND tenant_id = $2`, [documentId, tenantId]);
        if (!doc)
            throw new common_1.NotFoundException('Document not found');
        if (doc.status === 'rejected') {
            throw new common_1.ForbiddenException('Document has been rejected and cannot be accessed');
        }
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.bucket,
            Key: doc.s3_key,
            ResponseContentDisposition: `inline; filename="${doc.original_filename}"`,
        });
        const downloadUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3, command, { expiresIn: this.signedUrlExpiry });
        const expiresAt = new Date(Date.now() + this.signedUrlExpiry * 1000);
        await this.dataSource.query(`INSERT INTO document_access_logs
        (document_id, tenant_id, accessed_by, access_type, ip_address, expires_at)
       VALUES ($1,$2,$3,'view',$4,$5)`, [documentId, tenantId, requestedBy, ipAddress, expiresAt]);
        return { downloadUrl, expiresAt };
    }
    async reviewDocument(documentId, tenantId, action, reviewedBy, notes, rejectionReason) {
        const [doc] = await this.dataSource.query(`SELECT * FROM documents WHERE id = $1 AND tenant_id = $2`, [documentId, tenantId]);
        if (!doc)
            throw new common_1.NotFoundException('Document not found');
        const newStatus = action === 'verify' ? enums_1.DocumentStatus.VERIFIED : enums_1.DocumentStatus.REJECTED;
        await this.dataSource.query(`UPDATE documents
       SET status = $3, reviewed_by = $4, reviewed_at = NOW(),
           review_notes = $5, rejection_reason = $6
       WHERE id = $1 AND tenant_id = $2`, [documentId, tenantId, newStatus, reviewedBy, notes, rejectionReason]);
        if (doc.entity_type === 'application') {
            await this.dataSource.query(`UPDATE application_documents SET status = $3
         WHERE application_id = $1 AND document_type_code = $2`, [doc.entity_id, doc.document_type_code, newStatus]);
        }
        await this.dataSource.query(`INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
       VALUES ($1,$2,$3,'documents','documents',$4,$5,NOW())`, [tenantId, reviewedBy, `document.${action}d`, documentId,
            JSON.stringify({ status: newStatus, notes, rejectionReason })]);
        if (action === 'reject' && doc.entity_type === 'application') {
            const [app] = await this.dataSource.query(`SELECT a.student_id, s.first_name, s.last_name, s.email, p.name AS program_name
         FROM applications a
         JOIN students s ON s.id = a.student_id
         LEFT JOIN programs p ON p.id = a.program_id
         WHERE a.id = $1 AND a.tenant_id = $2`, [doc.entity_id, tenantId]);
            if (app?.email) {
                await this.notifications.send({
                    tenantId,
                    recipientId: app.student_id,
                    recipientEmail: app.email,
                    channel: enums_1.NotificationChannel.EMAIL,
                    templateCode: 'document_requested',
                    variables: {
                        studentName: `${app.first_name} ${app.last_name}`.trim(),
                        programName: app.program_name || 'your program',
                        missingDocuments: rejectionReason || `${doc.document_type_code} (rejected, please resubmit)`,
                    },
                    referenceId: documentId,
                    referenceType: 'document',
                }).catch(err => this.logger.error('Notification document_requested failed', err));
            }
        }
        return { documentId, status: newStatus };
    }
    async getDocumentsForEntity(entityType, entityId, tenantId) {
        return this.dataSource.query(`SELECT d.id, d.document_type_code, dt.display_name, dt.category,
              d.original_filename, d.status, d.file_size_bytes,
              d.uploaded_at, d.reviewed_at, d.rejection_reason,
              u.full_name AS reviewed_by_name
       FROM documents d
       LEFT JOIN document_types dt ON dt.code = d.document_type_code
       LEFT JOIN users u ON u.id = d.reviewed_by
       WHERE d.entity_type = $1 AND d.entity_id = $2 AND d.tenant_id = $3
       ORDER BY d.created_at DESC`, [entityType, entityId, tenantId]);
    }
    async getDocumentChecklistForMyUniversity(applicationId, tenantId, callerUserId) {
        const [owned] = await this.dataSource.query(`SELECT 1 FROM applications a
       JOIN universities uni ON uni.id = a.university_id
       WHERE a.id = $1 AND a.tenant_id = $2 AND uni.user_id = $3`, [applicationId, tenantId, callerUserId]);
        if (!owned)
            throw new common_1.NotFoundException('Application not found');
        return this.getDocumentChecklist(applicationId, tenantId);
    }
    async getDocumentChecklist(applicationId, tenantId) {
        const [application] = await this.dataSource.query(`SELECT university_id FROM applications WHERE id = $1 AND tenant_id = $2`, [applicationId, tenantId]);
        if (!application)
            throw new common_1.NotFoundException('Application not found');
        const requiredPolicy = await this.policyService.resolve('document.requirements.standard', { tenantId, universityId: application.university_id });
        const requiredCodes = requiredPolicy?.value || [];
        const uploadedDocs = await this.dataSource.query(`SELECT ad.document_type_code, ad.status, d.original_filename,
              d.uploaded_at, d.reviewed_at
       FROM application_documents ad
       JOIN documents d ON d.id = ad.document_id
       WHERE ad.application_id = $1`, [applicationId]);
        const uploadedMap = Object.fromEntries(uploadedDocs.map((d) => [d.document_type_code, d]));
        return requiredCodes.map((code) => ({
            documentTypeCode: code,
            required: true,
            uploaded: !!uploadedMap[code],
            status: uploadedMap[code]?.status || 'absent',
            fileName: uploadedMap[code]?.original_filename,
            uploadedAt: uploadedMap[code]?.uploaded_at,
            reviewedAt: uploadedMap[code]?.reviewed_at,
        }));
    }
    getExtension(contentType) {
        const map = {
            'application/pdf': '.pdf',
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
        };
        return map[contentType] || '';
    }
};
exports.DocumentsService = DocumentsService;
exports.DocumentsService = DocumentsService = DocumentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        config_1.ConfigService,
        policy_service_1.PolicyService,
        notifications_service_1.NotificationsService])
], DocumentsService);
//# sourceMappingURL=documents.service.js.map