import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { addHours } from 'date-fns';
import * as crypto from 'crypto';
import { hashPassword } from '../common/utils/password.util';
import { generateSecureToken, hashToken } from '../common/utils/encryption.util';
import { MembershipStatus, MembershipRequestStatus, UserStatus, NotificationChannel } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { DigitalPassService } from '../digital-pass/digital-pass.service';
import { CreateMembershipRequestDto } from './dto/create-membership-request.dto';

const PASSWORD_SETUP_TOKEN_TTL_HOURS = 48;
const FORSA_ID_MAX_ATTEMPTS = 5;
const POSTGRES_UNIQUE_VIOLATION = '23505';

// Phase 2 — FORSA ID: a human-readable member identifier, assigned once on
// Bronze issuance, never regenerated. FORSA-<year>-<6 uppercase hex chars>,
// e.g. FORSA-2026-3F9A2B. No sequence/counter table — a random suffix with
// a retry-on-collision loop is simpler and avoids a second point of
// contention on what's otherwise a single-row INSERT.
export function generateForsaId(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `FORSA-${year}-${suffix}`;
}

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly digitalPass: DigitalPassService,
  ) {}

  // T-203 — genuinely public, no auth. Deliberately minimal fields only
  // (see CreateMembershipRequestDto) — no guarantor, no financial
  // documents at this stage.
  async createRequest(dto: CreateMembershipRequestDto) {
    const existing = await this.dataSource.query<any[]>(
      `SELECT id FROM membership_requests
       WHERE tenant_id = $1 AND email = $2 AND status = 'pending'`,
      [dto.tenantId, dto.email],
    );
    if (existing.length) {
      throw new BadRequestException('A membership request for this email is already pending review');
    }

    // Phase 5 UX audit finding — the pending-request check above never
    // caught someone who is already a FORSA member submitting a brand-new
    // request through the public "Join FORSA" form; it silently created a
    // redundant record in the review queue instead of telling them they
    // already have an account.
    const existingMember = await this.dataSource.query<any[]>(
      `SELECT id FROM students WHERE tenant_id = $1 AND email = $2`,
      [dto.tenantId, dto.email],
    );
    if (existingMember.length) {
      throw new BadRequestException('An active FORSA membership already exists for this email. Please log in instead.');
    }

    const [request] = await this.dataSource.query<any[]>(
      `INSERT INTO membership_requests
        (tenant_id, first_name, last_name, phone, email, city, university_id,
         programme, academic_year, current_or_future_student, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
       RETURNING id, created_at`,
      [
        dto.tenantId, dto.firstName, dto.lastName, dto.phone, dto.email, dto.city,
        dto.universityId || null, dto.programme, dto.academicYear, dto.currentOrFutureStudent,
      ],
    );

    // T-225 — recipientId has no real user account yet at this point (a
    // visitor submitting a request, before any students/users row
    // exists) — notification_logs.recipient_id is NOT NULL, so the
    // request's own id is the only real UUID available; reference_id/
    // reference_type already capture this same relationship for the
    // audit trail.
    await this.notifications.send({
      tenantId: dto.tenantId,
      recipientId: request.id,
      recipientEmail: dto.email,
      channel: NotificationChannel.EMAIL,
      templateCode: 'membership_submitted',
      variables: { firstName: dto.firstName },
      referenceId: request.id,
      referenceType: 'membership_request',
    }).catch(err => this.logger.error('membership_submitted notification failed', err));

    return { id: request.id, status: MembershipRequestStatus.PENDING, createdAt: request.created_at };
  }

  async findAll(tenantId: string, status?: string) {
    if (status) {
      return this.dataSource.query(
        `SELECT mr.*, u.name AS university_name FROM membership_requests mr
         LEFT JOIN universities u ON u.id = mr.university_id
         WHERE mr.tenant_id = $1 AND mr.status = $2
         ORDER BY mr.created_at ASC`,
        [tenantId, status],
      );
    }
    return this.dataSource.query(
      `SELECT mr.*, u.name AS university_name FROM membership_requests mr
       LEFT JOIN universities u ON u.id = mr.university_id
       WHERE mr.tenant_id = $1
       ORDER BY mr.created_at DESC`,
      [tenantId],
    );
  }

  async findOne(id: string, tenantId: string) {
    const [request] = await this.dataSource.query<any[]>(
      `SELECT mr.*, u.name AS university_name FROM membership_requests mr
       LEFT JOIN universities u ON u.id = mr.university_id
       WHERE mr.id = $1 AND mr.tenant_id = $2`,
      [id, tenantId],
    );
    if (!request) throw new NotFoundException('Membership request not found');
    return request;
  }

  // T-204/FORSA-ID — on approval: provision a real students + users row
  // transactionally, issue Bronze membership + a permanent FORSA ID, and
  // email a set-password link (D-001 — never invent a password).
  async approve(id: string, tenantId: string, approvedBy: string) {
    const request = await this.findOne(id, tenantId);
    if (request.status !== MembershipRequestStatus.PENDING) {
      throw new BadRequestException(`Membership request is already ${request.status}`);
    }

    const existingUser = await this.dataSource.query<any[]>(
      `SELECT id FROM users WHERE tenant_id = $1 AND email = $2`,
      [tenantId, request.email],
    );
    if (existingUser.length) {
      throw new BadRequestException('An account with this email already exists');
    }

    // Resolve a unique FORSA ID *before* opening the transaction — a failed
    // INSERT inside a Postgres transaction aborts the whole transaction
    // (everything after it errors with "current transaction is aborted"
    // until rollback), so retrying past a UNIQUE-constraint collision
    // cannot happen mid-transaction without a SAVEPOINT. A pre-check here
    // is simpler and the collision window it leaves (another approval
    // landing the exact same id between this check and the INSERT below)
    // is vanishingly small — forsa_id's UNIQUE constraint is still the
    // real backstop if that ever happens.
    let forsaId = generateForsaId();
    for (let attempt = 1; attempt < FORSA_ID_MAX_ATTEMPTS; attempt++) {
      const [clash] = await this.dataSource.query<any[]>(
        `SELECT id FROM students WHERE forsa_id = $1`, [forsaId],
      );
      if (!clash) break;
      forsaId = generateForsaId();
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const [student] = await manager.query<any[]>(
        `INSERT INTO students
          (tenant_id, first_name, last_name, email, phone_primary, city,
           status, membership_status, member_since, forsa_id)
         VALUES ($1,$2,$3,$4,$5,$6,'lead',$7,CURRENT_DATE,$8)
         RETURNING id, first_name, last_name, email, forsa_id`,
        [
          tenantId, request.first_name, request.last_name, request.email,
          request.phone, request.city, MembershipStatus.BRONZE, forsaId,
        ],
      );

      // D-001: never invent a real password — this hash is an
      // unusable placeholder (random, never handed to the user); the
      // account only becomes usable once POST /auth/set-password
      // consumes a valid token below.
      const placeholderHash = await hashPassword(generateSecureToken(32));

      const [user] = await manager.query<any[]>(
        `INSERT INTO users
          (tenant_id, email, email_verified, password_hash, full_name, status,
           must_change_password, portal_type, student_id_linked)
         VALUES ($1,$2,false,$3,$4,$5,true,'student',$6)
         RETURNING id, email`,
        [
          tenantId, request.email, placeholderHash,
          `${request.first_name} ${request.last_name}`.trim(),
          UserStatus.PENDING_VERIFICATION, student.id,
        ],
      );

      await manager.query(`UPDATE students SET user_id = $2 WHERE id = $1`, [student.id, user.id]);

      // T-205 — issued in the same transaction as Bronze itself: a Bronze
      // member should never exist without a pass, or vice versa.
      await this.digitalPass.issueForStudentTx(manager, student.id, tenantId);

      await manager.query(
        `INSERT INTO membership_status_history
          (student_id, tenant_id, previous_status, new_status, reason, changed_by)
         VALUES ($1,$2,NULL,$3,'Membership request approved',$4)`,
        [student.id, tenantId, MembershipStatus.BRONZE, approvedBy],
      );

      await manager.query(
        `UPDATE membership_requests
         SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(), provisioned_student_id = $3
         WHERE id = $1`,
        [id, approvedBy, student.id],
      );

      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);
      await manager.query(
        `INSERT INTO password_setup_tokens (user_id, tenant_id, token_hash, expires_at)
         VALUES ($1,$2,$3,$4)`,
        [user.id, tenantId, tokenHash, addHours(new Date(), PASSWORD_SETUP_TOKEN_TTL_HOURS)],
      );

      await manager.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
         VALUES ($1,$2,'membership.approved','membership','students',$3,$4,NOW())`,
        [tenantId, approvedBy, student.id, JSON.stringify({ email: request.email, membershipStatus: MembershipStatus.BRONZE })],
      ).catch(() => {});

      return { studentId: student.id, userId: user.id, email: user.email, forsaId: student.forsa_id, rawToken };
    });

    const setPasswordUrl = `${process.env.STUDENT_PORTAL_URL || 'https://student.forsa.tn'}/set-password?token=${result.rawToken}`;
    await this.notifications.send({
      tenantId,
      recipientId: result.userId,
      recipientEmail: result.email,
      channel: NotificationChannel.EMAIL,
      templateCode: 'membership_approved',
      variables: { studentName: request.first_name, forsaId: result.forsaId, setPasswordUrl },
      triggeredBy: approvedBy,
      referenceId: result.studentId,
      referenceType: 'student',
    }).catch(err => this.logger.error('membership_approved notification failed', err));

    // T-225 — the Digital Pass is issued in the same transaction as
    // Bronze itself (see issueForStudentTx above), but is its own
    // distinct notification event per the trigger list.
    await this.notifications.send({
      tenantId,
      recipientId: result.userId,
      recipientEmail: result.email,
      channel: NotificationChannel.EMAIL,
      templateCode: 'digital_pass_ready',
      variables: { studentName: request.first_name },
      triggeredBy: approvedBy,
      referenceId: result.studentId,
      referenceType: 'student',
    }).catch(err => this.logger.error('digital_pass_ready notification failed', err));

    return { studentId: result.studentId, membershipStatus: MembershipStatus.BRONZE, forsaId: result.forsaId };
  }

  async reject(id: string, tenantId: string, rejectedBy: string, reason: string) {
    const request = await this.findOne(id, tenantId);
    if (request.status !== MembershipRequestStatus.PENDING) {
      throw new BadRequestException(`Membership request is already ${request.status}`);
    }

    await this.dataSource.query(
      `UPDATE membership_requests
       SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), rejection_reason = $3
       WHERE id = $1`,
      [id, rejectedBy, reason],
    );

    // Phase 8 workflow audit — this was the one decision point in the
    // whole product with zero applicant-facing notification at all: a
    // rejected visitor got no email and was left silently wondering what
    // happened, unlike every other approval/rejection path.
    await this.notifications.send({
      tenantId,
      recipientId: id,
      recipientEmail: request.email,
      channel: NotificationChannel.EMAIL,
      templateCode: 'membership_rejected',
      variables: {
        firstName: request.first_name,
        reasonBlock: reason ? `<p><strong>Reason:</strong> ${reason}</p>` : '',
      },
      triggeredBy: rejectedBy,
      referenceId: id,
      referenceType: 'membership_request',
    }).catch(err => this.logger.error('membership_rejected notification failed', err));

    return { id, status: MembershipRequestStatus.REJECTED };
  }
}
