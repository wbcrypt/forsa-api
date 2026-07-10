import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ContractType, ContractStatus, NotificationChannel } from '../common/enums';
import { PolicyService } from '../policy/policy.service';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);
  private readonly s3: S3Client;

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
  }

  /**
   * Generate a contract for a financing decision.
   * Contract terms are derived from the financing decision and agreement — nothing hardcoded.
   */
  async generateContract(params: {
    tenantId: string;
    applicationId: string;
    contractType: ContractType;
    financingDecisionId: string;
    generatedBy: string;
  }) {
    // Load financing decision + application + agreement
    const [decision] = await this.dataSource.query<any[]>(
      `SELECT fd.*, a.student_id, a.university_id, a.program_id, a.tuition_amount,
              a.currency, a.academic_year,
              s.first_name, s.last_name,
              u.name AS university_name
       FROM financing_decisions fd
       JOIN applications a ON a.id = fd.application_id
       JOIN students s ON s.id = a.student_id
       JOIN universities u ON u.id = a.university_id
       WHERE fd.id = $1 AND fd.tenant_id = $2`,
      [params.financingDecisionId, params.tenantId],
    );
    if (!decision) throw new NotFoundException('Tuition facilitation decision not found');

    // Get payment terms from university agreement
    const [agreement] = await this.dataSource.query<any[]>(
      `SELECT * FROM university_agreements
       WHERE university_id = $1 AND tenant_id = $2 AND status = 'active' LIMIT 1`,
      [decision.university_id, params.tenantId],
    );

    // Build contract terms object — all terms from decision/agreement, none hardcoded
    const contractTerms = {
      contractType: params.contractType,
      studentName: `${decision.first_name} ${decision.last_name}`,
      universityName: decision.university_name,
      approvedLevel: decision.approved_level,
      approvedAmount: decision.approved_amount,
      currency: decision.currency,
      academicYear: decision.academic_year,
      paymentModel: agreement?.payment_model,
      refundPolicy: agreement?.refund_policy,
      effectiveDate: new Date().toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
      financingDecisionId: params.financingDecisionId,
      policyVersionIds: decision.policy_version_ids,
    };

    // Contract version — each generation is a new version
    const [versionRow] = await this.dataSource.query<any[]>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next
       FROM contracts WHERE application_id = $1 AND contract_type = $2`,
      [params.applicationId, params.contractType],
    );

    const s3Key = `${params.tenantId}/contracts/${params.applicationId}/${params.contractType}/v${versionRow.next}.json`;

    // Store contract terms in S3 (not DB — no large blobs in DB)
    await this.s3.send(new PutObjectCommand({
      Bucket: this.configService.get<string>('s3.bucket')!,
      Key: s3Key,
      Body: JSON.stringify(contractTerms, null, 2),
      ContentType: 'application/json',
      // ServerSideEncryption: not supported by MinIO dev
    }));

    const [contract] = await this.dataSource.query<any[]>(
      `INSERT INTO contracts
        (tenant_id, application_id, financing_decision_id, contract_type, version,
         status, terms_s3_key, terms_s3_bucket, contract_terms_summary, generated_by)
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9)
       RETURNING *`,
      [
        params.tenantId, params.applicationId, params.financingDecisionId,
        params.contractType, versionRow.next,
        s3Key, this.configService.get<string>('s3.bucket'),
        JSON.stringify({
          approvedAmount: contractTerms.approvedAmount,
          approvedLevel: contractTerms.approvedLevel,
          paymentModel: contractTerms.paymentModel,
        }),
        params.generatedBy,
      ],
    );

    await this.audit(params.tenantId, params.generatedBy, 'contract.generated', contract.id, null, contractTerms);
    return contract;
  }

  async sendForSignature(contractId: string, tenantId: string, sentBy: string) {
    const [contract] = await this.dataSource.query<any[]>(
      `SELECT * FROM contracts WHERE id = $1 AND tenant_id = $2 AND status = 'draft'`,
      [contractId, tenantId],
    );
    if (!contract) throw new NotFoundException('Contract not found or not in draft status');

    await this.dataSource.query(
      `UPDATE contracts SET status = 'sent_for_signature', sent_for_signature_at = NOW()
       WHERE id = $1`,
      [contractId],
    );

    await this.audit(tenantId, sentBy, 'contract.sent_for_signature', contractId, null, {});

    const [student] = await this.dataSource.query<any[]>(
      `SELECT s.id, s.first_name, s.last_name, s.email
       FROM applications a JOIN students s ON s.id = a.student_id
       WHERE a.id = $1 AND a.tenant_id = $2`,
      [contract.application_id, tenantId],
    );
    if (student?.email) {
      await this.notifications.send({
        tenantId,
        recipientId: student.id,
        recipientEmail: student.email,
        channel: NotificationChannel.EMAIL,
        templateCode: 'contract_ready',
        variables: { studentName: `${student.first_name} ${student.last_name}`.trim() },
        referenceId: contractId,
        referenceType: 'contract',
      }).catch(err => this.logger.error('Notification contract_ready failed', err));
    }

    return { contractId, status: ContractStatus.SENT_FOR_SIGNATURE };
  }

  async recordSignature(params: {
    contractId: string;
    tenantId: string;
    signatoryType: 'student' | 'forsa' | 'university' | 'guarantor';
    signatoryId: string;
    signatureReference: string;
    signedBy: string;
  }) {
    const [contract] = await this.dataSource.query<any[]>(
      `SELECT * FROM contracts WHERE id = $1 AND tenant_id = $2`,
      [params.contractId, params.tenantId],
    );
    if (!contract) throw new NotFoundException('Contract not found');

    // Record signature
    await this.dataSource.query(
      `INSERT INTO contract_signatures
        (contract_id, signatory_type, signatory_id, signature_reference, signed_at)
       VALUES ($1,$2,$3,$4,NOW())`,
      [params.contractId, params.signatoryType, params.signatoryId, params.signatureReference],
    );

    // Check if all required signatures collected
    const [signatureCount] = await this.dataSource.query<any[]>(
      `SELECT COUNT(*) AS count FROM contract_signatures WHERE contract_id = $1`,
      [params.contractId],
    );

    // Determine required signatories based on contract type
    const requiredMap: Record<string, number> = {
      [ContractType.STUDENT_FORSA]: 2,
      [ContractType.FORSA_UNIVERSITY]: 2,
      [ContractType.GUARANTOR_FORSA]: 2,
    };
    const required = requiredMap[contract.contract_type] || 2;

    const newStatus = parseInt(signatureCount.count) >= required
      ? ContractStatus.FULLY_SIGNED
      : ContractStatus.PARTIALLY_SIGNED;

    await this.dataSource.query(
      `UPDATE contracts SET status = $2, fully_signed_at = CASE WHEN $2 = 'fully_signed' THEN NOW() ELSE NULL END
       WHERE id = $1`,
      [params.contractId, newStatus],
    );

    await this.audit(params.tenantId, params.signedBy, 'contract.signed', params.contractId, null,
      { signatoryType: params.signatoryType, newStatus });

    return { contractId: params.contractId, status: newStatus };
  }

  async getContractsForApplication(applicationId: string, tenantId: string) {
    return this.dataSource.query(
      `SELECT c.*,
              json_agg(cs.*) FILTER (WHERE cs.id IS NOT NULL) AS signatures
       FROM contracts c
       LEFT JOIN contract_signatures cs ON cs.contract_id = c.id
       WHERE c.application_id = $1 AND c.tenant_id = $2
       GROUP BY c.id
       ORDER BY c.version DESC`,
      [applicationId, tenantId],
    );
  }

  async getContractDownloadUrl(contractId: string, tenantId: string, _requestedBy: string) {
    const [contract] = await this.dataSource.query<any[]>(
      `SELECT * FROM contracts WHERE id = $1 AND tenant_id = $2`,
      [contractId, tenantId],
    );
    if (!contract) throw new NotFoundException('Contract not found');

    const command = {
      Bucket: contract.terms_s3_bucket,
      Key: contract.terms_s3_key,
    };

    const url = await getSignedUrl(this.s3, new GetObjectCommand(command), {
      expiresIn: this.configService.get<number>('s3.signedUrlExpiry') || 300,
    });

    return { downloadUrl: url, expiresIn: 300 };
  }

  private async audit(tenantId: string, userId: string, action: string, targetId: string, prev: any, next: any) {
    await this.dataSource.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
       VALUES ($1,$2,$3,'contracts','contracts',$4,$5,NOW())`,
      [tenantId, userId, action, targetId, next ? JSON.stringify(next) : null],
    ).catch(err => this.logger.error('Audit log failed', err));
  }
}
