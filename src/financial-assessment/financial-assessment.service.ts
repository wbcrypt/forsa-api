import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { encrypt, decrypt } from '../common/utils/encryption.util';
import { calculateFinancialScore, FinancialScoringInput } from './financial-assessment.scoring';
import { FinancialAssessmentPolicyService } from './financial-assessment-policy.service';
import {
  INTERVIEW_CHECKLIST, RELATIONSHIPS, GOVERNORATES, EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, ADDITIONAL_INCOME_TYPES,
} from './financial-assessment.constants';
import { UpdateFinancialAssessmentDto } from './dto/update-financial-assessment.dto';
import { SubmitFinancialAssessmentDto } from './dto/submit-financial-assessment.dto';
import { VerifyFinancialAssessmentDto } from './dto/verify-financial-assessment.dto';

// Every column on financial_assessments that the guarantor declares and
// interview staff may later correct. Single source of truth for: building
// the upsert SQL, diffing corrections during verification, and building
// the scoring input — so a field can never go out of sync between those
// three uses.
const EDITABLE_FIELDS: { dto: string; column: string }[] = [
  { dto: 'fullName', column: 'full_name' },
  { dto: 'relationship', column: 'relationship' },
  { dto: 'dateOfBirth', column: 'date_of_birth' },
  { dto: 'phoneNumber', column: 'phone_number' },
  { dto: 'governorate', column: 'governorate' },
  { dto: 'employmentStatus', column: 'employment_status' },
  { dto: 'employerName', column: 'employer_name' },
  { dto: 'jobTitle', column: 'job_title' },
  { dto: 'yearsWithEmployer', column: 'years_with_employer' },
  { dto: 'employmentType', column: 'employment_type' },
  { dto: 'monthlyNetIncome', column: 'monthly_net_income' },
  { dto: 'additionalIncomeType', column: 'additional_income_type' },
  { dto: 'additionalIncomeAmount', column: 'additional_income_amount' },
  { dto: 'monthlyLoanPayments', column: 'monthly_loan_payments' },
  { dto: 'hasPreviousUnpaidInstallments', column: 'has_previous_unpaid_installments' },
  { dto: 'bankName', column: 'bank_name' },
  { dto: 'hasReturnedCheque', column: 'has_returned_cheque' },
  { dto: 'hasSalarySeizure', column: 'has_salary_seizure' },
  { dto: 'hasFrequentOverdraft', column: 'has_frequent_overdraft' },
  { dto: 'approximateSavings', column: 'approximate_savings' },
];

// Every question the wizard presents as mandatory (steps 1-6 minus the
// fields that are legitimately blank for some guarantors — employer
// name/job title/tenure for the unemployed, additional income for anyone
// without any). Enforced here, not just client-side, so the boolean
// banking questions especially can't be silently skipped to inflate the
// Banking Behaviour Score (an unanswered boolean reads as "no red flag").
const REQUIRED_TO_SUBMIT = [
  'fullName', 'cinNumber', 'relationship', 'dateOfBirth', 'phoneNumber', 'governorate',
  'employmentStatus', 'employmentType',
  'monthlyNetIncome',
  'monthlyLoanPayments', 'hasPreviousUnpaidInstallments',
  'bankName', 'hasReturnedCheque', 'hasSalarySeizure', 'hasFrequentOverdraft',
  'approximateSavings',
];

@Injectable()
export class FinancialAssessmentService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly policy: FinancialAssessmentPolicyService,
  ) {}

  private get piiKey(): string {
    return this.configService.get<string>('encryption.piiKey')!;
  }

  // ================================================================
  // Guarantor self-service
  // ================================================================

  private async findOwnLink(userId: string, tenantId: string) {
    const [link] = await this.dataSource.query<any[]>(
      `SELECT g.id AS guarantor_id, a.id AS application_id, a.student_id
       FROM guarantors g
       JOIN student_guarantors sg ON sg.guarantor_id = g.id AND sg.status = 'active'
       JOIN students s ON s.id = sg.student_id
       JOIN applications a ON a.student_id = s.id AND a.tenant_id = $2
       WHERE g.user_id = $1 AND g.tenant_id = $2
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [userId, tenantId],
    );
    if (!link) {
      throw new NotFoundException('No application found yet for this guarantor — the Financial Assessment can only be started once a Tuition Facilitation application exists.');
    }
    return link as { guarantor_id: string; application_id: string; student_id: string };
  }

  private toResponse(row: any) {
    if (!row) return null;
    const cinNumber = row.cin_reference ? this.safeDecrypt(row.cin_reference) : undefined;
    const { cin_reference: _cin_reference, ...rest } = row;
    return { ...rest, cinNumber };
  }

  private safeDecrypt(value: string): string {
    try {
      return decrypt(value, this.piiKey);
    } catch {
      return '[decryption error]';
    }
  }

  async getMine(userId: string, tenantId: string) {
    const link = await this.findOwnLink(userId, tenantId);
    const [row] = await this.dataSource.query<any[]>(
      `SELECT * FROM financial_assessments WHERE application_id = $1`,
      [link.application_id],
    );
    return {
      assessment: this.toResponse(row),
      checklist: row?.status === 'submitted' ? this.buildChecklist(row) : null,
    };
  }

  async saveDraft(userId: string, tenantId: string, dto: UpdateFinancialAssessmentDto) {
    const link = await this.findOwnLink(userId, tenantId);

    const [existing] = await this.dataSource.query<any[]>(
      `SELECT status FROM financial_assessments WHERE application_id = $1`,
      [link.application_id],
    );
    if (existing?.status === 'submitted') {
      throw new BadRequestException('This assessment has already been submitted. Further changes must go through interview verification.');
    }

    await this.upsert(link, tenantId, dto);
    const [row] = await this.dataSource.query<any[]>(
      `SELECT * FROM financial_assessments WHERE application_id = $1`,
      [link.application_id],
    );
    return this.toResponse(row);
  }

  async submit(userId: string, tenantId: string, dto: SubmitFinancialAssessmentDto) {
    if (!dto.confirmed) {
      throw new BadRequestException('You must confirm that all information provided is accurate before submitting.');
    }

    const link = await this.findOwnLink(userId, tenantId);
    const [existing] = await this.dataSource.query<any[]>(
      `SELECT status FROM financial_assessments WHERE application_id = $1`,
      [link.application_id],
    );
    if (existing?.status === 'submitted') {
      throw new BadRequestException('This assessment has already been submitted.');
    }

    await this.upsert(link, tenantId, dto);
    const [row] = await this.dataSource.query<any[]>(
      `SELECT * FROM financial_assessments WHERE application_id = $1`,
      [link.application_id],
    );

    // cinNumber isn't a plain column (it's encrypted into cin_reference) — check it separately.
    const missingFields = REQUIRED_TO_SUBMIT.filter((f) => {
      if (f === 'cinNumber') return !row.cin_reference;
      const col = EDITABLE_FIELDS.find((e) => e.dto === f)?.column;
      return col ? row[col] == null : true;
    });
    if (missingFields.length > 0) {
      throw new BadRequestException(`Missing required fields before submission: ${missingFields.join(', ')}`);
    }

    const scoringInput = this.buildScoringInput(row);
    const policyConfig = await this.policy.getConfig(tenantId);
    const score = calculateFinancialScore(scoringInput, policyConfig);

    const declaredSnapshot = { ...row, cin_reference: undefined };

    // No RETURNING here — TypeORM's Postgres driver returns UPDATE/DELETE
    // results as a [rows, affectedCount] tuple (unlike INSERT, which
    // returns rows directly), so `const [x] = await query(...)` on an
    // UPDATE...RETURNING silently binds `x` to the *rows array*, not a
    // row. Simplest reliable fix: plain UPDATE, then a follow-up SELECT
    // (which always returns a flat rows array), matching upsert()'s
    // pattern above.
    await this.dataSource.query(
      `UPDATE financial_assessments SET
         status = 'submitted',
         self_declaration_confirmed = true,
         submitted_at = NOW(),
         declared_snapshot = $2,
         total_monthly_income = $3,
         income_score = $4, debt_ratio_score = $5, employment_score = $6,
         banking_score = $7, savings_score = $8, final_score = $9, score_band = $10,
         score_calculated_at = NOW(),
         updated_at = NOW()
       WHERE application_id = $1`,
      [
        link.application_id, JSON.stringify(declaredSnapshot), score.totalMonthlyIncome,
        score.incomeScore, score.debtRatioScore, score.employmentScore,
        score.bankingScore, score.savingsScore, score.finalScore, score.band,
      ],
    );
    const [updated] = await this.dataSource.query<any[]>(
      `SELECT * FROM financial_assessments WHERE application_id = $1`,
      [link.application_id],
    );

    return { assessment: this.toResponse(updated), checklist: this.buildChecklist(updated) };
  }

  getOptions() {
    return { RELATIONSHIPS, GOVERNORATES, EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, ADDITIONAL_INCOME_TYPES };
  }

  private buildChecklist(row: any) {
    return INTERVIEW_CHECKLIST.map((item) => ({
      ...item,
      applicable: item.code === 'loan_repayment_documents' ? Number(row.monthly_loan_payments) > 0 : true,
    }));
  }

  private async upsert(
    link: { guarantor_id: string; application_id: string; student_id: string },
    tenantId: string,
    dto: UpdateFinancialAssessmentDto,
  ) {
    const cinEncrypted = dto.cinNumber ? encrypt(dto.cinNumber, this.piiKey) : undefined;

    // Every column is always written via COALESCE(new, existing) rather
    // than building a dynamic SET clause per-field — avoids positional-index
    // juggling across a variable field list.
    await this.dataSource.query(
      `INSERT INTO financial_assessments (
         tenant_id, application_id, student_id, guarantor_id, cin_reference,
         full_name, relationship, date_of_birth, phone_number, governorate,
         employment_status, employer_name, job_title, years_with_employer, employment_type,
         monthly_net_income, additional_income_type, additional_income_amount,
         monthly_loan_payments, has_previous_unpaid_installments,
         bank_name, has_returned_cheque, has_salary_seizure, has_frequent_overdraft,
         approximate_savings
       ) VALUES (
         $1,$2,$3,$4,$5, $6,$7,$8,$9,$10, $11,$12,$13,$14,$15, $16,$17,$18, $19,$20, $21,$22,$23,$24, $25
       )
       ON CONFLICT (application_id) DO UPDATE SET
         cin_reference = COALESCE($5, financial_assessments.cin_reference),
         full_name = COALESCE($6, financial_assessments.full_name),
         relationship = COALESCE($7, financial_assessments.relationship),
         date_of_birth = COALESCE($8, financial_assessments.date_of_birth),
         phone_number = COALESCE($9, financial_assessments.phone_number),
         governorate = COALESCE($10, financial_assessments.governorate),
         employment_status = COALESCE($11, financial_assessments.employment_status),
         employer_name = COALESCE($12, financial_assessments.employer_name),
         job_title = COALESCE($13, financial_assessments.job_title),
         years_with_employer = COALESCE($14, financial_assessments.years_with_employer),
         employment_type = COALESCE($15, financial_assessments.employment_type),
         monthly_net_income = COALESCE($16, financial_assessments.monthly_net_income),
         additional_income_type = COALESCE($17, financial_assessments.additional_income_type),
         additional_income_amount = COALESCE($18, financial_assessments.additional_income_amount),
         monthly_loan_payments = COALESCE($19, financial_assessments.monthly_loan_payments),
         has_previous_unpaid_installments = COALESCE($20, financial_assessments.has_previous_unpaid_installments),
         bank_name = COALESCE($21, financial_assessments.bank_name),
         has_returned_cheque = COALESCE($22, financial_assessments.has_returned_cheque),
         has_salary_seizure = COALESCE($23, financial_assessments.has_salary_seizure),
         has_frequent_overdraft = COALESCE($24, financial_assessments.has_frequent_overdraft),
         approximate_savings = COALESCE($25, financial_assessments.approximate_savings),
         updated_at = NOW()`,
      [
        tenantId, link.application_id, link.student_id, link.guarantor_id, cinEncrypted ?? null,
        dto.fullName ?? null, dto.relationship ?? null, dto.dateOfBirth ?? null, dto.phoneNumber ?? null, dto.governorate ?? null,
        dto.employmentStatus ?? null, dto.employerName ?? null, dto.jobTitle ?? null, dto.yearsWithEmployer ?? null, dto.employmentType ?? null,
        dto.monthlyNetIncome ?? null, dto.additionalIncomeType ?? null, dto.additionalIncomeAmount ?? null,
        dto.monthlyLoanPayments ?? null, dto.hasPreviousUnpaidInstallments ?? null,
        dto.bankName ?? null, dto.hasReturnedCheque ?? null, dto.hasSalarySeizure ?? null, dto.hasFrequentOverdraft ?? null,
        dto.approximateSavings ?? null,
      ],
    );

    // total_monthly_income is always server-derived from the merged row,
    // never trusted from the client — recompute after the merge above.
    await this.dataSource.query(
      `UPDATE financial_assessments
       SET total_monthly_income = COALESCE(monthly_net_income,0) + COALESCE(additional_income_amount,0)
       WHERE application_id = $1`,
      [link.application_id],
    );
  }

  private buildScoringInput(row: any): FinancialScoringInput {
    return {
      monthlyNetIncome: row.monthly_net_income != null ? Number(row.monthly_net_income) : null,
      additionalIncomeAmount: row.additional_income_amount != null ? Number(row.additional_income_amount) : null,
      monthlyLoanPayments: row.monthly_loan_payments != null ? Number(row.monthly_loan_payments) : null,
      hasPreviousUnpaidInstallments: row.has_previous_unpaid_installments,
      employmentStatus: row.employment_status,
      employmentType: row.employment_type,
      yearsWithEmployer: row.years_with_employer != null ? Number(row.years_with_employer) : null,
      hasReturnedCheque: row.has_returned_cheque,
      hasSalarySeizure: row.has_salary_seizure,
      hasFrequentOverdraft: row.has_frequent_overdraft,
      approximateSavings: row.approximate_savings != null ? Number(row.approximate_savings) : null,
    };
  }

  // ================================================================
  // Interview mode (staff)
  // ================================================================

  async getForInterview(tenantId: string, applicationId: string) {
    const [row] = await this.dataSource.query<any[]>(
      `SELECT fa.*, s.first_name, s.last_name, g.first_name AS guarantor_first_name, g.last_name AS guarantor_last_name,
              vb.full_name AS verified_by_name
       FROM financial_assessments fa
       JOIN students s ON s.id = fa.student_id
       JOIN guarantors g ON g.id = fa.guarantor_id
       LEFT JOIN users vb ON vb.id = fa.verified_by
       WHERE fa.application_id = $1 AND fa.tenant_id = $2`,
      [applicationId, tenantId],
    );
    if (!row) throw new NotFoundException('No Financial Assessment found for this application');

    const corrections = await this.dataSource.query<any[]>(
      `SELECT fac.field_name, fac.original_value, fac.verified_value, fac.changed_by, fac.changed_at,
              u.full_name AS changed_by_name
       FROM financial_assessment_field_corrections fac
       LEFT JOIN users u ON u.id = fac.changed_by
       WHERE fac.financial_assessment_id = $1
       ORDER BY fac.changed_at DESC`,
      [row.id],
    );

    return { assessment: this.toResponse(row), corrections };
  }

  async verify(tenantId: string, staffUserId: string, applicationId: string, dto: VerifyFinancialAssessmentDto) {
    const [row] = await this.dataSource.query<any[]>(
      `SELECT * FROM financial_assessments WHERE application_id = $1 AND tenant_id = $2`,
      [applicationId, tenantId],
    );
    if (!row) throw new NotFoundException('No Financial Assessment found for this application');
    if (row.status !== 'submitted') {
      throw new BadRequestException('This assessment has not been submitted by the guarantor yet — nothing to verify.');
    }

    // Log a correction row for every field the interviewer is actually
    // changing (skip no-ops so the audit trail only records real edits).
    const corrections: { field: string; original: any; verified: any }[] = [];
    for (const f of EDITABLE_FIELDS) {
      const incoming = (dto as any)[f.dto];
      if (incoming === undefined) continue;
      const current = row[f.column];
      const changed = String(current ?? '') !== String(incoming ?? '');
      if (changed) corrections.push({ field: f.dto, original: current, verified: incoming });
    }
    if (dto.cinNumber) {
      const currentCin = row.cin_reference ? this.safeDecrypt(row.cin_reference) : null;
      if (currentCin !== dto.cinNumber) corrections.push({ field: 'cinNumber', original: currentCin, verified: dto.cinNumber });
    }

    await this.upsert({ guarantor_id: row.guarantor_id, application_id: row.application_id, student_id: row.student_id }, tenantId, dto);

    for (const c of corrections) {
      await this.dataSource.query(
        `INSERT INTO financial_assessment_field_corrections
           (financial_assessment_id, field_name, original_value, verified_value, changed_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [row.id, c.field, c.original == null ? null : String(c.original), c.verified == null ? null : String(c.verified), staffUserId],
      );
    }

    const [merged] = await this.dataSource.query<any[]>(
      `SELECT * FROM financial_assessments WHERE application_id = $1`,
      [applicationId],
    );
    const policyConfig = await this.policy.getConfig(tenantId);
    const score = calculateFinancialScore(this.buildScoringInput(merged), policyConfig);

    // No RETURNING — see the comment in submit() above; UPDATE...RETURNING
    // through this driver returns a [rows, affectedCount] tuple, not rows.
    await this.dataSource.query(
      `UPDATE financial_assessments SET
         interview_notes = $2,
         income_score = $3, debt_ratio_score = $4, employment_score = $5,
         banking_score = $6, savings_score = $7, final_score = $8, score_band = $9,
         score_calculated_at = NOW(),
         ${dto.decision ? 'verification_status = $10, verified_by = $11, verified_at = NOW(),' : ''}
         updated_at = NOW()
       WHERE application_id = $1`,
      dto.decision
        ? [
          applicationId, dto.interviewNotes ?? merged.interview_notes,
          score.incomeScore, score.debtRatioScore, score.employmentScore,
          score.bankingScore, score.savingsScore, score.finalScore, score.band,
          dto.decision, staffUserId,
        ]
        : [
          applicationId, dto.interviewNotes ?? merged.interview_notes,
          score.incomeScore, score.debtRatioScore, score.employmentScore,
          score.bankingScore, score.savingsScore, score.finalScore, score.band,
        ],
    );
    const [updated] = await this.dataSource.query<any[]>(
      `SELECT * FROM financial_assessments WHERE application_id = $1`,
      [applicationId],
    );

    return { assessment: this.toResponse(updated), corrections: corrections.length };
  }
}
