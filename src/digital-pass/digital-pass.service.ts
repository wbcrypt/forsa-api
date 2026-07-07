import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import * as QRCode from 'qrcode';
import { generateSecureToken } from '../common/utils/encryption.util';

@Injectable()
export class DigitalPassService {
  private readonly logger = new Logger(DigitalPassService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // T-205 — issued exactly once, inside the same transaction as
  // MembershipService.approve() (an EntityManager is passed in explicitly
  // rather than this service opening its own transaction, so the pass and
  // the Bronze-issuing students/users rows commit or fail together — a
  // Bronze member should never exist without a pass, or vice versa).
  async issueForStudentTx(manager: EntityManager, studentId: string, tenantId: string): Promise<{ verificationToken: string }> {
    const verificationToken = generateSecureToken(24);
    await manager.query(
      `INSERT INTO digital_student_passes (student_id, tenant_id, verification_token, status)
       VALUES ($1,$2,$3,'active')`,
      [studentId, tenantId, verificationToken],
    );
    return { verificationToken };
  }

  // T-206 — public, no auth: the QR scan target. Deliberately a live
  // status check (queries the current membership_status/pass status every
  // time), not a cached/static payload embedded in the QR code itself.
  // University/academic year are read from the student's originating
  // membership_requests row rather than denormalized onto the pass, so
  // there's exactly one place that data can drift from.
  async verifyByToken(token: string) {
    const [pass] = await this.dataSource.query<any[]>(
      `SELECT
         dsp.status AS pass_status, dsp.issued_at,
         s.first_name, s.last_name, s.forsa_id, s.membership_status, s.member_since,
         u.name AS university_name, mr.academic_year
       FROM digital_student_passes dsp
       JOIN students s ON s.id = dsp.student_id
       LEFT JOIN membership_requests mr ON mr.provisioned_student_id = s.id
       LEFT JOIN universities u ON u.id = mr.university_id
       WHERE dsp.verification_token = $1`,
      [token],
    );
    if (!pass) throw new NotFoundException('This pass does not exist or the link is invalid');

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

  // Self-scoped, mirrors StudentsService.findMe/findMyPayments — resolves
  // via the caller's own user_id, never a client-supplied student id.
  async findMyPass(userId: string, tenantId: string) {
    // Was `SELECT dsp.*` — the join to students existed only to scope by
    // user_id, so forsa_id/membership_status/member_since (everything the
    // student portal's PassPage.tsx actually renders besides the QR code)
    // were silently absent from every response.
    const [pass] = await this.dataSource.query<any[]>(
      `SELECT dsp.*, s.first_name, s.last_name, s.forsa_id, s.membership_status, s.member_since
       FROM digital_student_passes dsp
       JOIN students s ON s.id = dsp.student_id
       WHERE s.user_id = $1 AND dsp.tenant_id = $2`,
      [userId, tenantId],
    );
    if (!pass) throw new NotFoundException('No Digital Student Pass has been issued yet');

    const verifyUrl = `${process.env.APP_URL || 'https://api.forsa.tn'}/api/v1/pass/verify/${pass.verification_token}`;
    const qrCode = await QRCode.toDataURL(verifyUrl);

    return { ...pass, qrCode };
  }

  async findAll(tenantId: string) {
    return this.dataSource.query(
      `SELECT dsp.id, dsp.status, dsp.issued_at, dsp.revoked_at, dsp.revoked_reason,
              s.id AS student_id, s.first_name, s.last_name, s.forsa_id, s.membership_status
       FROM digital_student_passes dsp
       JOIN students s ON s.id = dsp.student_id
       WHERE dsp.tenant_id = $1
       ORDER BY dsp.issued_at DESC`,
      [tenantId],
    );
  }

  async revoke(id: string, tenantId: string, revokedBy: string, reason: string) {
    const [pass] = await this.dataSource.query<any[]>(
      `SELECT id, status FROM digital_student_passes WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!pass) throw new NotFoundException('Digital Student Pass not found');
    if (pass.status === 'revoked') throw new BadRequestException('This pass is already revoked');

    await this.dataSource.query(
      `UPDATE digital_student_passes
       SET status = 'revoked', revoked_at = NOW(), revoked_by = $2, revoked_reason = $3
       WHERE id = $1`,
      [id, revokedBy, reason],
    );
    return { id, status: 'revoked' };
  }
}
