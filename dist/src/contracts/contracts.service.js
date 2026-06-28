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
var ContractsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const enums_1 = require("../common/enums");
const policy_service_1 = require("../policy/policy.service");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
let ContractsService = ContractsService_1 = class ContractsService {
    constructor(dataSource, configService, policyService) {
        this.dataSource = dataSource;
        this.configService = configService;
        this.policyService = policyService;
        this.logger = new common_1.Logger(ContractsService_1.name);
        this.s3 = new client_s3_1.S3Client({
            endpoint: configService.get('s3.endpoint'),
            region: configService.get('s3.region'),
            credentials: {
                accessKeyId: configService.get('s3.accessKeyId'),
                secretAccessKey: configService.get('s3.secretAccessKey'),
            },
            forcePathStyle: configService.get('s3.forcePathStyle'),
        });
    }
    async generateContract(params) {
        const [decision] = await this.dataSource.query(`SELECT fd.*, a.student_id, a.university_id, a.program_id, a.tuition_amount,
              a.currency, a.academic_year,
              s.first_name, s.last_name,
              u.name AS university_name
       FROM financing_decisions fd
       JOIN applications a ON a.id = fd.application_id
       JOIN students s ON s.id = a.student_id
       JOIN universities u ON u.id = a.university_id
       WHERE fd.id = $1 AND fd.tenant_id = $2`, [params.financingDecisionId, params.tenantId]);
        if (!decision)
            throw new common_1.NotFoundException('Financing decision not found');
        const templatePolicy = await this.policyService.resolve(`contract.template.${params.contractType}`, { tenantId: params.tenantId, universityId: decision.university_id });
        const [agreement] = await this.dataSource.query(`SELECT * FROM university_agreements
       WHERE university_id = $1 AND tenant_id = $2 AND status = 'active' LIMIT 1`, [decision.university_id, params.tenantId]);
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
        const [versionRow] = await this.dataSource.query(`SELECT COALESCE(MAX(version), 0) + 1 AS next
       FROM contracts WHERE application_id = $1 AND contract_type = $2`, [params.applicationId, params.contractType]);
        const s3Key = `${params.tenantId}/contracts/${params.applicationId}/${params.contractType}/v${versionRow.next}.json`;
        await this.s3.send(new client_s3_1.PutObjectCommand({
            Bucket: this.configService.get('s3.bucket'),
            Key: s3Key,
            Body: JSON.stringify(contractTerms, null, 2),
            ContentType: 'application/json',
        }));
        const [contract] = await this.dataSource.query(`INSERT INTO contracts
        (tenant_id, application_id, financing_decision_id, contract_type, version,
         status, terms_s3_key, terms_s3_bucket, contract_terms_summary, generated_by)
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9)
       RETURNING *`, [
            params.tenantId, params.applicationId, params.financingDecisionId,
            params.contractType, versionRow.next,
            s3Key, this.configService.get('s3.bucket'),
            JSON.stringify({
                approvedAmount: contractTerms.approvedAmount,
                approvedLevel: contractTerms.approvedLevel,
                paymentModel: contractTerms.paymentModel,
            }),
            params.generatedBy,
        ]);
        await this.audit(params.tenantId, params.generatedBy, 'contract.generated', contract.id, null, contractTerms);
        return contract;
    }
    async sendForSignature(contractId, tenantId, sentBy) {
        const [contract] = await this.dataSource.query(`SELECT * FROM contracts WHERE id = $1 AND tenant_id = $2 AND status = 'draft'`, [contractId, tenantId]);
        if (!contract)
            throw new common_1.NotFoundException('Contract not found or not in draft status');
        await this.dataSource.query(`UPDATE contracts SET status = 'sent_for_signature', sent_for_signature_at = NOW()
       WHERE id = $1`, [contractId]);
        await this.audit(tenantId, sentBy, 'contract.sent_for_signature', contractId, null, {});
        return { contractId, status: enums_1.ContractStatus.SENT_FOR_SIGNATURE };
    }
    async recordSignature(params) {
        const [contract] = await this.dataSource.query(`SELECT * FROM contracts WHERE id = $1 AND tenant_id = $2`, [params.contractId, params.tenantId]);
        if (!contract)
            throw new common_1.NotFoundException('Contract not found');
        await this.dataSource.query(`INSERT INTO contract_signatures
        (contract_id, signatory_type, signatory_id, signature_reference, signed_at)
       VALUES ($1,$2,$3,$4,NOW())`, [params.contractId, params.signatoryType, params.signatoryId, params.signatureReference]);
        const [signatureCount] = await this.dataSource.query(`SELECT COUNT(*) AS count FROM contract_signatures WHERE contract_id = $1`, [params.contractId]);
        const requiredMap = {
            [enums_1.ContractType.STUDENT_FORSA]: 2,
            [enums_1.ContractType.FORSA_UNIVERSITY]: 2,
            [enums_1.ContractType.GUARANTOR_FORSA]: 2,
        };
        const required = requiredMap[contract.contract_type] || 2;
        const newStatus = parseInt(signatureCount.count) >= required
            ? enums_1.ContractStatus.FULLY_SIGNED
            : enums_1.ContractStatus.PARTIALLY_SIGNED;
        await this.dataSource.query(`UPDATE contracts SET status = $2, fully_signed_at = CASE WHEN $2 = 'fully_signed' THEN NOW() ELSE NULL END
       WHERE id = $1`, [params.contractId, newStatus]);
        await this.audit(params.tenantId, params.signedBy, 'contract.signed', params.contractId, null, { signatoryType: params.signatoryType, newStatus });
        return { contractId: params.contractId, status: newStatus };
    }
    async getContractsForApplication(applicationId, tenantId) {
        return this.dataSource.query(`SELECT c.*,
              json_agg(cs.*) FILTER (WHERE cs.id IS NOT NULL) AS signatures
       FROM contracts c
       LEFT JOIN contract_signatures cs ON cs.contract_id = c.id
       WHERE c.application_id = $1 AND c.tenant_id = $2
       GROUP BY c.id
       ORDER BY c.version DESC`, [applicationId, tenantId]);
    }
    async getContractDownloadUrl(contractId, tenantId, requestedBy) {
        const [contract] = await this.dataSource.query(`SELECT * FROM contracts WHERE id = $1 AND tenant_id = $2`, [contractId, tenantId]);
        if (!contract)
            throw new common_1.NotFoundException('Contract not found');
        const command = {
            Bucket: contract.terms_s3_bucket,
            Key: contract.terms_s3_key,
        };
        const url = await (0, s3_request_presigner_1.getSignedUrl)(this.s3, new client_s3_1.GetObjectCommand(command), {
            expiresIn: this.configService.get('s3.signedUrlExpiry') || 300,
        });
        return { downloadUrl: url, expiresIn: 300 };
    }
    async audit(tenantId, userId, action, targetId, prev, next) {
        await this.dataSource.query(`INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
       VALUES ($1,$2,$3,'contracts','contracts',$4,$5,NOW())`, [tenantId, userId, action, targetId, next ? JSON.stringify(next) : null]).catch(err => this.logger.error('Audit log failed', err));
    }
};
exports.ContractsService = ContractsService;
exports.ContractsService = ContractsService = ContractsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        config_1.ConfigService,
        policy_service_1.PolicyService])
], ContractsService);
//# sourceMappingURL=contracts.service.js.map