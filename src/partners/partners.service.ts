import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CommissionStatus } from '../common/enums';
import { PaginationDto, paginate, getSkip } from '../common/utils/pagination.util';
import { PolicyService } from '../policy/policy.service';

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policyService: PolicyService,
  ) {}

  async create(dto: any, tenantId: string, createdBy: string) {
    const [partner] = await this.dataSource.query<any[]>(
      `INSERT INTO partners
        (tenant_id, name, type, website, country_code, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7)
       RETURNING *`,
      [tenantId, dto.name, dto.type, dto.website, dto.countryCode, dto.notes, createdBy],
    );

    await this.audit(tenantId, createdBy, 'partner.created', partner.id, null, dto);
    return partner;
  }

  async findAll(tenantId: string, pagination: PaginationDto, filters?: any) {
    const { page = 1, limit = 20 } = pagination;
    const offset = getSkip(page, limit);

    const [data, [count]] = await Promise.all([
      this.dataSource.query(
        `SELECT p.*,
                COUNT(DISTINCT pc.id) AS total_referrals,
                COUNT(DISTINCT pc.id) FILTER (WHERE pc.status = 'paid') AS paid_commissions,
                COALESCE(SUM(pc.partner_share) FILTER (WHERE pc.status = 'paid'), 0) AS total_earned
         FROM partners p
         LEFT JOIN partner_commissions pc ON pc.partner_id = p.id
         WHERE p.tenant_id = $1
         GROUP BY p.id
         ORDER BY p.name ASC
         LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) FROM partners WHERE tenant_id = $1`,
        [tenantId],
      ),
    ]);

    return paginate(data, parseInt(count.count), page, limit);
  }

  /**
   * Resolve the partner record for the authenticated portal user — server-side
   * only, keyed by JWT user id. Never accept a client-supplied partner id for
   * this lookup (see T-103 / K-03: a partner portal previously trusted
   * `partners[0]` from a list endpoint, which could leak another partner's
   * students/commissions).
   */
  async findMe(userId: string, tenantId: string) {
    const [partner] = await this.dataSource.query<any[]>(
      `SELECT p.*,
              COUNT(DISTINCT pc.id) AS total_referrals,
              COUNT(DISTINCT pc.id) FILTER (WHERE pc.status = 'paid') AS paid_commissions,
              COALESCE(SUM(pc.partner_share) FILTER (WHERE pc.status = 'paid'), 0) AS total_earned
       FROM partners p
       LEFT JOIN partner_commissions pc ON pc.partner_id = p.id
       WHERE p.user_id = $1 AND p.tenant_id = $2
       GROUP BY p.id`,
      [userId, tenantId],
    );
    if (!partner) throw new NotFoundException('No partner account linked to this user');
    return partner;
  }

  // T-224 discovery — forsa-partner's Dashboard/Students/Reports pages
  // called GET /applications?partnerId=X (a staff-only application.view
  // route) expecting it to filter by partner. It doesn't: findAll's
  // recognized filters are status/universityId/financingLevel/
  // assignedTo/search — partnerId was never one of them, so the
  // parameter was silently ignored. Combined with application.view being
  // a staff permission no partner-portal account holds, this meant the
  // pages either 403'd outright, or — if that permission were ever
  // broadly granted — would return every application across the entire
  // tenant to any partner, a cross-partner data leak. Fixed the same way
  // as every other self-scoped route this phase: resolve the partner
  // via the JWT identity (partners.user_id), never a client-supplied id
  // or query param, and filter by that partner's own id server-side.
  async getMyApplications(userId: string, tenantId: string, pagination: PaginationDto) {
    const partner = await this.findMe(userId, tenantId);
    const { page = 1, limit = 20 } = pagination;
    const offset = getSkip(page, limit);

    const [data, [count]] = await Promise.all([
      this.dataSource.query<any[]>(
        `SELECT a.id, a.current_status, a.current_financing_level, a.tuition_amount,
                a.currency, a.lead_date, a.academic_year,
                s.first_name, s.last_name, s.email,
                u.name AS university_name, p.name AS program_name
         FROM applications a
         JOIN students s ON s.id = a.student_id
         JOIN universities u ON u.id = a.university_id
         LEFT JOIN programs p ON p.id = a.program_id
         WHERE a.tenant_id = $1 AND a.partner_id = $2
         ORDER BY a.created_at DESC
         LIMIT $3 OFFSET $4`,
        [tenantId, partner.id, limit, offset],
      ),
      this.dataSource.query<any[]>(
        `SELECT COUNT(*) FROM applications WHERE tenant_id = $1 AND partner_id = $2`,
        [tenantId, partner.id],
      ),
    ]);

    return paginate(data, parseInt(count.count, 10), page, limit);
  }

  // T-224 discovery — forsa-partner's ProfilePage.tsx called
  // partnerApi.update(partner.id, ...) -> PATCH /partners/:id, but no
  // such route (or service method) has ever existed in this controller —
  // editing name/website was completely non-functional (404), not just
  // an identity-trust issue. Self-scoped like every other 'me' route:
  // resolves the partner via the JWT identity, updates only the two
  // fields a partner is allowed to self-manage (name, website) — status,
  // type, commission rates, agreements remain staff-only via the
  // existing :id routes.
  async updateMe(userId: string, tenantId: string, dto: { name?: string; website?: string }) {
    const partner = await this.findMe(userId, tenantId);
    const [updated] = await this.dataSource.query<any[]>(
      `UPDATE partners SET name = COALESCE($3, name), website = COALESCE($4, website), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [partner.id, tenantId, dto.name, dto.website],
    );
    return updated;
  }

  // T-224 discovery — forsa-partner's DashboardPage/ReportsPage called
  // partnerApi.getDashboard(partner.id) -> GET /partners/:id/dashboard,
  // gated behind the staff-only partner.view permission — no partner-
  // portal account holds it, so this 403'd unconditionally. Same fix
  // pattern as getMyApplications/updateMe above: self-scoped, resolved
  // via the JWT identity.
  async getMyDashboard(userId: string, tenantId: string) {
    const partner = await this.findMe(userId, tenantId);
    return this.getPartnerDashboard(partner.id, tenantId);
  }

  // T-224 discovery — worse than the two above: partnerApi
  // .getCommissions() called GET /partners/commissions, gated behind
  // partner.commission.approve (a staff *approval* permission) — 403'd
  // unconditionally for any partner-portal account. And even setting
  // that aside, getCommissions()'s query has no partner_id filter at
  // all (`WHERE pc.tenant_id = $1`) — every partner's commissions across
  // the entire tenant, not just the caller's own. Self-scoped and
  // properly filtered by the resolved partner's own id.
  async getMyCommissions(userId: string, tenantId: string, pagination: PaginationDto) {
    const partner = await this.findMe(userId, tenantId);
    const { page = 1, limit = 20 } = pagination;
    const offset = getSkip(page, limit);

    const [data, [count]] = await Promise.all([
      this.dataSource.query<any[]>(
        `SELECT pc.*, s.first_name, s.last_name, u.name AS university_name
         FROM partner_commissions pc
         JOIN students s ON s.id = pc.student_id
         JOIN applications a ON a.id = pc.application_id
         JOIN universities u ON u.id = a.university_id
         WHERE pc.tenant_id = $1 AND pc.partner_id = $2
         ORDER BY pc.created_at DESC
         LIMIT $3 OFFSET $4`,
        [tenantId, partner.id, limit, offset],
      ),
      this.dataSource.query<any[]>(
        `SELECT COUNT(*) FROM partner_commissions WHERE tenant_id = $1 AND partner_id = $2`,
        [tenantId, partner.id],
      ),
    ]);

    return paginate(data, parseInt(count.count, 10), page, limit);
  }

  async findOne(id: string, tenantId: string) {
    const [partner] = await this.dataSource.query<any[]>(
      `SELECT p.*,
              json_agg(DISTINCT pc.*) FILTER (WHERE pc.id IS NOT NULL) AS contacts,
              json_agg(DISTINCT pa.*) FILTER (WHERE pa.id IS NOT NULL) AS agreements
       FROM partners p
       LEFT JOIN partner_contacts pc ON pc.partner_id = p.id AND pc.status = 'active'
       LEFT JOIN partner_agreements pa ON pa.partner_id = p.id
       WHERE p.id = $1 AND p.tenant_id = $2
       GROUP BY p.id`,
      [id, tenantId],
    );
    if (!partner) throw new NotFoundException('Partner not found');
    return partner;
  }

  async createAgreement(partnerId: string, tenantId: string, dto: any, createdBy: string) {
    await this.findOne(partnerId, tenantId);

    // Commission structures and amounts are NOT hardcoded here.
    // They are passed in from the DTO and validated against policy limits.
    const commissionStructure = dto.commissionStructure;
    if (!commissionStructure) {
      throw new BadRequestException('Commission structure is required');
    }

    const [agreement] = await this.dataSource.query<any[]>(
      `INSERT INTO partner_agreements
        (tenant_id, partner_id, version, commission_structure, payment_conditions,
         max_visible_information, allowed_reports, data_sharing_permissions,
         confidentiality_terms, fraud_prevention_terms, termination_conditions,
         audit_rights, effective_date, expiration_date, status, created_by)
       VALUES ($1,$2,
         (SELECT COALESCE(MAX(version), 0) + 1 FROM partner_agreements WHERE partner_id = $3),
         $4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft',$15)
       RETURNING *`,
      [
        tenantId, partnerId, partnerId,
        JSON.stringify(commissionStructure),
        JSON.stringify(dto.paymentConditions || {}),
        JSON.stringify(dto.maxVisibleInformation || {}),
        dto.allowedReports || [],
        JSON.stringify(dto.dataSharingPermissions || {}),
        dto.confidentialityTerms,
        dto.fraudPreventionTerms,
        dto.terminationConditions,
        dto.auditRights || false,
        dto.effectiveDate,
        dto.expirationDate || null,
        createdBy,
      ],
    );

    await this.audit(tenantId, createdBy, 'partner.agreement.created', agreement.id, null, dto);
    return agreement;
  }

  /**
   * Calculate commission for a referral — amount determined by agreement, not hardcoded
   */
  async calculateCommission(
    partnerId: string,
    applicationId: string,
    tenantId: string,
  ): Promise<{
    grossAmount: number;
    forsaShare: number;
    partnerShare: number;
    commissionBasis: string;
    policyVersionId: string;
  }> {
    // Get active partner agreement
    const [agreement] = await this.dataSource.query<any[]>(
      `SELECT * FROM partner_agreements
       WHERE partner_id = $1 AND tenant_id = $2 AND status = 'active'
       ORDER BY effective_date DESC LIMIT 1`,
      [partnerId, tenantId],
    );

    if (!agreement) throw new BadRequestException('No active partner agreement found');

    // Get application details for calculation basis
    const [application] = await this.dataSource.query<any[]>(
      `SELECT * FROM applications WHERE id = $1 AND tenant_id = $2`,
      [applicationId, tenantId],
    );

    if (!application) throw new NotFoundException('Application not found');

    // Commission calculation logic driven entirely by agreement structure
    // No hardcoded percentages — all values come from the agreement
    const structure = agreement.commission_structure;
    let grossAmount = 0;
    let forsaShare = 0;
    let partnerShare = 0;
    const commissionBasis = structure.basis || 'flat_fee';

    switch (commissionBasis) {
      case 'flat_fee':
        grossAmount = structure.flat_amount || 0;
        partnerShare = grossAmount * (structure.partner_percentage / 100);
        forsaShare = grossAmount - partnerShare;
        break;

      case 'percentage_tuition':
        grossAmount = application.tuition_amount * (structure.percentage / 100);
        partnerShare = grossAmount * (structure.partner_percentage / 100);
        forsaShare = grossAmount - partnerShare;
        break;

      case 'percentage_financed':
        const financedAmount = application.tuition_amount; // use actual financed amount
        grossAmount = financedAmount * (structure.percentage / 100);
        partnerShare = grossAmount * (structure.partner_percentage / 100);
        forsaShare = grossAmount - partnerShare;
        break;

      default:
        throw new BadRequestException(`Unknown commission basis: ${commissionBasis}`);
    }

    // Apply policy-level caps if configured
    const policyCap = await this.policyService.getNumber(
      'commission.structure.default',
      { tenantId, partnerId },
    );

    return {
      grossAmount: Math.round(grossAmount * 100) / 100,
      forsaShare: Math.round(forsaShare * 100) / 100,
      partnerShare: Math.round(partnerShare * 100) / 100,
      commissionBasis,
      policyVersionId: agreement.id,
    };
  }

  async createCommissionRecord(
    partnerId: string,
    partnAgreementId: string,
    applicationId: string,
    studentId: string,
    tenantId: string,
    calculation: any,
    policyVersionId: string,
  ) {
    const [commission] = await this.dataSource.query<any[]>(
      `INSERT INTO partner_commissions
        (tenant_id, partner_id, partner_agreement_id, application_id, student_id,
         commission_basis, gross_amount, forsa_share, partner_share, currency,
         policy_version_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'TND',$10,'lead')
       RETURNING *`,
      [
        tenantId, partnerId, partnAgreementId, applicationId, studentId,
        calculation.commissionBasis, calculation.grossAmount,
        calculation.forsaShare, calculation.partnerShare,
        policyVersionId,
      ],
    );
    return commission;
  }

  async advanceCommissionStatus(
    commissionId: string,
    tenantId: string,
    newStatus: CommissionStatus,
    approvedBy: string,
  ) {
    const validTransitions: Record<string, CommissionStatus[]> = {
      [CommissionStatus.LEAD]: [CommissionStatus.ELIGIBLE, CommissionStatus.CANCELLED],
      [CommissionStatus.ELIGIBLE]: [CommissionStatus.APPROVED, CommissionStatus.CANCELLED],
      [CommissionStatus.APPROVED]: [CommissionStatus.UNIVERSITY_PAID, CommissionStatus.CANCELLED],
      [CommissionStatus.UNIVERSITY_PAID]: [CommissionStatus.PAYABLE],
      [CommissionStatus.PAYABLE]: [CommissionStatus.PAID],
      [CommissionStatus.PAID]: [CommissionStatus.CLAWBACK_INITIATED],
      [CommissionStatus.CLAWBACK_INITIATED]: [CommissionStatus.CLAWED_BACK],
    };

    const [commission] = await this.dataSource.query<any[]>(
      `SELECT * FROM partner_commissions WHERE id = $1 AND tenant_id = $2`,
      [commissionId, tenantId],
    );

    if (!commission) throw new NotFoundException('Commission not found');

    const allowed = validTransitions[commission.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${commission.status} to ${newStatus}`,
      );
    }

    const [updated] = await this.dataSource.query<any[]>(
      `UPDATE partner_commissions
       SET status = $3,
           approved_by = CASE WHEN $3 = 'approved' THEN $4 ELSE approved_by END,
           approved_at = CASE WHEN $3 = 'approved' THEN NOW() ELSE approved_at END,
           paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [commissionId, tenantId, newStatus, approvedBy],
    );

    await this.audit(tenantId, approvedBy, 'partner.commission.status_changed', commissionId,
      { status: commission.status }, { status: newStatus });

    return updated;
  }

  async getCommissions(tenantId: string, filters: any, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = getSkip(page, limit);

    const [data, [count]] = await Promise.all([
      this.dataSource.query(
        `SELECT pc.*, p.name AS partner_name, s.first_name, s.last_name,
                u.name AS university_name
         FROM partner_commissions pc
         JOIN partners p ON p.id = pc.partner_id
         JOIN students s ON s.id = pc.student_id
         JOIN applications a ON a.id = pc.application_id
         JOIN universities u ON u.id = a.university_id
         WHERE pc.tenant_id = $1
         ORDER BY pc.created_at DESC
         LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) FROM partner_commissions WHERE tenant_id = $1`,
        [tenantId],
      ),
    ]);

    return paginate(data, parseInt(count.count), page, limit);
  }

  async getPartnerDashboard(partnerId: string, tenantId: string) {
    // Returns only information permitted by the partner's agreement (min necessary)
    const [agreement] = await this.dataSource.query<any[]>(
      `SELECT max_visible_information FROM partner_agreements
       WHERE partner_id = $1 AND tenant_id = $2 AND status = 'active'
       LIMIT 1`,
      [partnerId, tenantId],
    );

    // Base stats — always visible
    const [stats] = await this.dataSource.query<any[]>(
      `SELECT
         COUNT(*) AS total_leads,
         COUNT(*) FILTER (WHERE pc.status IN ('approved','university_paid','payable','paid')) AS accepted,
         COUNT(*) FILTER (WHERE a.current_status = 'rejected') AS rejected,
         COALESCE(SUM(pc.partner_share) FILTER (WHERE pc.status = 'paid'), 0) AS paid_commission,
         COALESCE(SUM(pc.partner_share) FILTER (WHERE pc.status IN ('payable','approved','university_paid')), 0) AS pending_commission,
         CASE WHEN COUNT(*) > 0 THEN
           ROUND(COUNT(*) FILTER (WHERE pc.status NOT IN ('lead','cancelled'))::numeric / COUNT(*) * 100, 2)
         ELSE 0 END AS conversion_rate
       FROM partner_commissions pc
       JOIN applications a ON a.id = pc.application_id
       WHERE pc.partner_id = $1 AND pc.tenant_id = $2`,
      [partnerId, tenantId],
    );

    return stats;
  }

  private async audit(tenantId: string, userId: string, action: string, targetId: string, prev: any, next: any) {
    await this.dataSource.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, previous_value, new_value, created_at)
       VALUES ($1,$2,$3,'partners','partners',$4,$5,$6,NOW())`,
      [tenantId, userId, action, targetId,
       prev ? JSON.stringify(prev) : null, next ? JSON.stringify(next) : null],
    ).catch(err => this.logger.error('Audit log failed', err));
  }
}
