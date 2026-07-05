import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { sha256, generateSecureToken } from '../common/utils/encryption.util';
import { DocumentStatus, NotificationChannel } from '../common/enums';
import { PolicyService } from '../policy/policy.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly signedUrlExpiry: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly policyService: PolicyService,
    private readonly notifications: NotificationsService,
  ) {
    this.s3 = new S3Client({
      endpoint: configService.get<string>('s3.endpoint'),
      region: configService.get<string>('s3.region'),
      credentials: {
        accessKeyId: configService.get<string>('s3.accessKeyId')!,
        secretAccessKey: configService.get<string>('s3.secretAccessKey')!,
      },
      forcePathStyle: configService.get<boolean>('s3.forcePathStyle'),
    });
    this.bucket = configService.get<string>('s3.bucket')!;
    this.signedUrlExpiry = configService.get<number>('s3.signedUrlExpiry') || 300;
  }

  /**
   * Generate a pre-signed upload URL.
   * No file content is stored in DB — only metadata and S3 key reference.
   */
  async generateUploadUrl(params: {
    tenantId: string;
    entityType: 'application' | 'student' | 'guarantor' | 'contract';
    entityId: string;
    documentTypeCode: string;
    fileName: string;
    contentType: string;
    uploadedBy: string;
  }): Promise<{
    uploadUrl: string;
    documentId: string;
    s3Key: string;
    expiresAt: Date;
  }> {
    // Validate document type
    const [docType] = await this.dataSource.query<any[]>(
      `SELECT * FROM document_types WHERE code = $1 AND is_active = true`,
      [params.documentTypeCode],
    );
    if (!docType) throw new BadRequestException(`Invalid document type: ${params.documentTypeCode}`);

    // Validate content type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(params.contentType)) {
      throw new BadRequestException('Only PDF and image files are allowed');
    }

    // Generate unique S3 key (tenant-scoped, no PII in key)
    const fileId = uuidv4();
    const ext = this.getExtension(params.contentType);
    const s3Key = `${params.tenantId}/${params.entityType}/${params.entityId}/${params.documentTypeCode}/${fileId}${ext}`;

    // Create document metadata record (status: uploading)
    const [document] = await this.dataSource.query<any[]>(
      `INSERT INTO documents
        (tenant_id, entity_type, entity_id, document_type_code, original_filename,
         s3_key, s3_bucket, content_type, status, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'uploading',$9)
       RETURNING id`,
      [
        params.tenantId, params.entityType, params.entityId,
        params.documentTypeCode, params.fileName,
        s3Key, this.bucket, params.contentType, params.uploadedBy,
      ],
    );

    // Generate pre-signed PUT URL
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: params.contentType,
      // ServerSideEncryption: not supported by MinIO dev
      Metadata: {
        'document-id': document.id,
        'tenant-id': params.tenantId,
        'uploaded-by': params.uploadedBy,
      },
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 600 }); // 10 min to upload
    const expiresAt = new Date(Date.now() + 600 * 1000);

    return { uploadUrl, documentId: document.id, s3Key, expiresAt };
  }

  /**
   * Confirm document upload complete (called after client completes upload)
   */
  async confirmUpload(documentId: string, tenantId: string, fileSize: number, checksum?: string) {
    const [doc] = await this.dataSource.query<any[]>(
      `SELECT * FROM documents WHERE id = $1 AND tenant_id = $2 AND status = 'uploading'`,
      [documentId, tenantId],
    );
    if (!doc) throw new NotFoundException('Document not found or upload not pending');

    // T-208/T-209 — "all documents must be current": compute a real
    // expiry at upload time from document_types.validity_months (a gap
    // the spec described as already scaffolded but, confirmed directly
    // against the live schema, was not — see migrations/009). NULL
    // validity_months (the default) means this document type never
    // expires.
    const [docType] = await this.dataSource.query<any[]>(
      `SELECT validity_months FROM document_types WHERE code = $1`,
      [doc.document_type_code],
    );
    const documentExpiresAt = docType?.validity_months
      ? `NOW() + INTERVAL '${parseInt(docType.validity_months, 10)} months'`
      : null;

    await this.dataSource.query(
      `UPDATE documents
       SET status = 'uploaded', file_size_bytes = $3, checksum_sha256 = $4, uploaded_at = NOW(),
           expires_at = ${documentExpiresAt || 'NULL'}
       WHERE id = $1 AND tenant_id = $2`,
      [documentId, tenantId, fileSize, checksum || null],
    );

    // If linked to application, update document checklist
    if (doc.entity_type === 'application') {
      await this.dataSource.query(
        `INSERT INTO application_documents
          (application_id, document_id, document_type_code, status)
         VALUES ($1,$2,$3,'uploaded')
         ON CONFLICT (application_id, document_type_code) DO UPDATE SET document_id = $2, status = 'uploaded'`,
        [doc.entity_id, documentId, doc.document_type_code],
      );
    }

    return { documentId, status: DocumentStatus.UPLOADED };
  }

  /**
   * Generate a pre-signed download (view) URL — short-lived, logged
   */
  async generateDownloadUrl(
    documentId: string,
    tenantId: string,
    requestedBy: string,
    ipAddress: string,
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    const [doc] = await this.dataSource.query<any[]>(
      `SELECT * FROM documents WHERE id = $1 AND tenant_id = $2`,
      [documentId, tenantId],
    );
    if (!doc) throw new NotFoundException('Document not found');

    if (doc.status === 'rejected') {
      throw new ForbiddenException('Document has been rejected and cannot be accessed');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: doc.s3_key,
      ResponseContentDisposition: `inline; filename="${doc.original_filename}"`,
    });

    const downloadUrl = await getSignedUrl(this.s3, command, { expiresIn: this.signedUrlExpiry });
    const expiresAt = new Date(Date.now() + this.signedUrlExpiry * 1000);

    // Log document access for audit trail
    await this.dataSource.query(
      `INSERT INTO document_access_logs
        (document_id, tenant_id, accessed_by, access_type, ip_address, expires_at)
       VALUES ($1,$2,$3,'view',$4,$5)`,
      [documentId, tenantId, requestedBy, ipAddress, expiresAt],
    );

    return { downloadUrl, expiresAt };
  }

  /**
   * Review and verify/reject a document
   */
  async reviewDocument(
    documentId: string,
    tenantId: string,
    action: 'verify' | 'reject',
    reviewedBy: string,
    notes?: string,
    rejectionReason?: string,
  ) {
    const [doc] = await this.dataSource.query<any[]>(
      `SELECT * FROM documents WHERE id = $1 AND tenant_id = $2`,
      [documentId, tenantId],
    );
    if (!doc) throw new NotFoundException('Document not found');

    const newStatus = action === 'verify' ? DocumentStatus.VERIFIED : DocumentStatus.REJECTED;

    await this.dataSource.query(
      `UPDATE documents
       SET status = $3, reviewed_by = $4, reviewed_at = NOW(),
           review_notes = $5, rejection_reason = $6
       WHERE id = $1 AND tenant_id = $2`,
      [documentId, tenantId, newStatus, reviewedBy, notes, rejectionReason],
    );

    // Update application document checklist
    if (doc.entity_type === 'application') {
      await this.dataSource.query(
        `UPDATE application_documents SET status = $3
         WHERE application_id = $1 AND document_type_code = $2`,
        [doc.entity_id, doc.document_type_code, newStatus],
      );
    }

    await this.dataSource.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
       VALUES ($1,$2,$3,'documents','documents',$4,$5,NOW())`,
      [tenantId, reviewedBy, `document.${action}d`, documentId,
       JSON.stringify({ status: newStatus, notes, rejectionReason })],
    );

    // T-106 — a rejected document means the student needs to act (resubmit).
    // Only applies when the document is attached to an application (the
    // common case); other entity_type values (e.g. guarantor documents)
    // aren't wired to a student notification here yet.
    if (action === 'reject' && doc.entity_type === 'application') {
      const [app] = await this.dataSource.query<any[]>(
        `SELECT a.student_id, s.first_name, s.last_name, s.email, p.name AS program_name
         FROM applications a
         JOIN students s ON s.id = a.student_id
         LEFT JOIN programs p ON p.id = a.program_id
         WHERE a.id = $1 AND a.tenant_id = $2`,
        [doc.entity_id, tenantId],
      );
      if (app?.email) {
        await this.notifications.send({
          tenantId,
          recipientId: app.student_id,
          recipientEmail: app.email,
          channel: NotificationChannel.EMAIL,
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

  async getDocumentsForEntity(entityType: string, entityId: string, tenantId: string) {
    return this.dataSource.query(
      `SELECT d.id, d.document_type_code, dt.display_name, dt.category,
              d.original_filename, d.status, d.file_size_bytes,
              d.uploaded_at, d.reviewed_at, d.rejection_reason,
              u.full_name AS reviewed_by_name
       FROM documents d
       LEFT JOIN document_types dt ON dt.code = d.document_type_code
       LEFT JOIN users u ON u.id = d.reviewed_by
       WHERE d.entity_type = $1 AND d.entity_id = $2 AND d.tenant_id = $3
       ORDER BY d.created_at DESC`,
      [entityType, entityId, tenantId],
    );
  }

  async getDocumentChecklist(applicationId: string, tenantId: string) {
    const [application] = await this.dataSource.query<any[]>(
      `SELECT university_id FROM applications WHERE id = $1 AND tenant_id = $2`,
      [applicationId, tenantId],
    );
    if (!application) throw new NotFoundException('Application not found');

    // Get required documents for this context from policy
    const requiredPolicy = await this.policyService.resolve(
      'document.requirements.standard',
      { tenantId, universityId: application.university_id },
    );

    const requiredCodes = (requiredPolicy?.value as string[]) || [];

    const uploadedDocs = await this.dataSource.query(
      `SELECT ad.document_type_code, ad.status, d.original_filename,
              d.uploaded_at, d.reviewed_at
       FROM application_documents ad
       JOIN documents d ON d.id = ad.document_id
       WHERE ad.application_id = $1`,
      [applicationId],
    );

    const uploadedMap = Object.fromEntries(uploadedDocs.map((d: any) => [d.document_type_code, d]));

    return requiredCodes.map((code: string) => ({
      documentTypeCode: code,
      required: true,
      uploaded: !!uploadedMap[code],
      status: uploadedMap[code]?.status || 'absent',
      fileName: uploadedMap[code]?.original_filename,
      uploadedAt: uploadedMap[code]?.uploaded_at,
      reviewedAt: uploadedMap[code]?.reviewed_at,
    }));
  }

  private getExtension(contentType: string): string {
    const map: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    return map[contentType] || '';
  }
}
