import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

import { User } from './entities/user.entity';
import { UserStatus } from '../common/enums';
import { PaginationDto, paginate, getSkip } from '../common/utils/pagination.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateUserDto, tenantId: string, createdBy: string): Promise<User> {
    // Check uniqueness
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase(), tenantId },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    // Validate password complexity
    this.validatePasswordComplexity(dto.password);

    const passwordHash = await this.hashPassword(dto.password);

    const user = this.userRepository.create({
      tenantId,
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      fullName: dto.fullName,
      status: UserStatus.PENDING_VERIFICATION,
      createdBy,
      mustChangePassword: dto.mustChangePassword ?? true,
    });

    const saved = await this.userRepository.save(user);

    // Assign initial roles
    if (dto.roleIds?.length) {
      for (const roleId of dto.roleIds) {
        await this.dataSource.query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT DO NOTHING`,
          [saved.id, roleId, createdBy],
        );
      }
    }

    // Write audit log
    await this.writeAuditLog({
      tenantId,
      userId: createdBy,
      actionType: 'user.created',
      targetId: saved.id,
      newValue: { email: saved.email, fullName: saved.fullName },
    });

    return saved;
  }

  async findAll(tenantId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const [data, total] = await this.userRepository.findAndCount({
      where: { tenantId },
      select: ['id', 'email', 'fullName', 'status', 'mfaEnabled', 'lastLoginAt', 'createdAt'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: getSkip(page, limit),
    });
    return paginate(data, total, page, limit);
  }

  async findOne(id: string, tenantId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id, tenantId },
      select: ['id', 'email', 'fullName', 'status', 'mfaEnabled', 'lastLoginAt', 'createdAt', 'emailVerified'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase(), tenantId },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateUserDto, updatedBy: string): Promise<User> {
    const user = await this.findOne(id, tenantId);

    const previous = { fullName: user.fullName, status: user.status };

    if (dto.fullName) user.fullName = dto.fullName;
    if (dto.status) user.status = dto.status;

    const updated = await this.userRepository.save(user);

    await this.writeAuditLog({
      tenantId,
      userId: updatedBy,
      actionType: 'user.updated',
      targetId: id,
      previousValue: previous,
      newValue: { fullName: updated.fullName, status: updated.status },
    });

    return updated;
  }

  async deactivate(id: string, tenantId: string, deactivatedBy: string, reason: string): Promise<void> {
    const user = await this.findOne(id, tenantId);

    if (id === deactivatedBy) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    await this.userRepository.update(id, {
      status: UserStatus.DEACTIVATED,
      deactivatedBy,
      deactivatedAt: new Date(),
    });

    // Invalidate all sessions
    await this.dataSource.query(
      `UPDATE user_sessions SET invalidated_at = NOW(), invalidation_reason = 'admin_revoke'
       WHERE user_id = $1 AND invalidated_at IS NULL`,
      [id],
    );

    await this.writeAuditLog({
      tenantId,
      userId: deactivatedBy,
      actionType: 'user.deactivated',
      targetId: id,
      reason,
    });
  }

  async changePassword(
    userId: string,
    tenantId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isValid) throw new BadRequestException('Current password is incorrect');

    this.validatePasswordComplexity(newPassword);

    // Prevent reuse of current password
    if (await argon2.verify(user.passwordHash, newPassword)) {
      throw new BadRequestException('New password must be different from current password');
    }

    const newHash = await this.hashPassword(newPassword);
    await this.userRepository.update(userId, {
      passwordHash: newHash,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    });

    // Invalidate all other sessions
    await this.dataSource.query(
      `UPDATE user_sessions SET invalidated_at = NOW(), invalidation_reason = 'password_change'
       WHERE user_id = $1 AND invalidated_at IS NULL`,
      [userId],
    );
  }

  async getUserRolesAndPermissions(userId: string, tenantId: string) {
    const roles = await this.dataSource.query(
      `SELECT r.id, r.name, r.description
       FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1
         AND (ur.effective_until IS NULL OR ur.effective_until > CURRENT_DATE)
         AND ur.revoked_at IS NULL`,
      [userId],
    );

    const permissions = await this.dataSource.query(
      `SELECT DISTINCT p.code, p.module, p.action, p.is_high_impact
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = $1
         AND (ur.effective_until IS NULL OR ur.effective_until > CURRENT_DATE)
         AND ur.revoked_at IS NULL`,
      [userId],
    );

    return { roles, permissions };
  }

  async assignRole(
    userId: string,
    roleId: string,
    tenantId: string,
    assignedBy: string,
  ): Promise<void> {
    // Verify user and role belong to same tenant
    const [user, role] = await Promise.all([
      this.findOne(userId, tenantId),
      this.dataSource.query(
        `SELECT id FROM roles WHERE id = $1 AND tenant_id = $2`,
        [roleId, tenantId],
      ),
    ]);

    if (!role.length) throw new NotFoundException('Role not found');

    await this.dataSource.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, role_id, effective_from) DO NOTHING`,
      [userId, roleId, assignedBy],
    );

    await this.writeAuditLog({
      tenantId,
      userId: assignedBy,
      actionType: 'user.role.assigned',
      targetId: userId,
      newValue: { roleId },
    });
  }

  async revokeRole(
    userId: string,
    roleId: string,
    tenantId: string,
    revokedBy: string,
    reason: string,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE user_roles
       SET revoked_by = $3, revoked_at = NOW(), revocation_reason = $4
       WHERE user_id = $1 AND role_id = $2 AND revoked_at IS NULL`,
      [userId, roleId, revokedBy, reason],
    );

    await this.writeAuditLog({
      tenantId,
      userId: revokedBy,
      actionType: 'user.role.revoked',
      targetId: userId,
      newValue: { roleId, reason },
    });
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private async hashPassword(password: string): Promise<string> {
    const rounds = this.configService.get<number>('security.bcryptRounds') || 12;
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: rounds >= 12 ? 3 : 2,
      parallelism: 4,
    });
  }

  private validatePasswordComplexity(password: string): void {
    const minLength = this.configService.get<number>('security.passwordMinLength') || 12;

    if (password.length < minLength) {
      throw new BadRequestException(`Password must be at least ${minLength} characters`);
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasDigit || !hasSpecial) {
      throw new BadRequestException(
        'Password must contain uppercase, lowercase, digit, and special character',
      );
    }
  }

  private async writeAuditLog(entry: {
    tenantId: string;
    userId: string;
    actionType: string;
    targetId: string;
    previousValue?: any;
    newValue?: any;
    reason?: string;
  }): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO audit_logs
        (tenant_id, user_id, action_type, module, target_entity, target_id,
         previous_value, new_value, reason, created_at)
       VALUES ($1,$2,$3,'users','users',$4,$5,$6,$7,NOW())`,
      [
        entry.tenantId,
        entry.userId,
        entry.actionType,
        entry.targetId,
        entry.previousValue ? JSON.stringify(entry.previousValue) : null,
        entry.newValue ? JSON.stringify(entry.newValue) : null,
        entry.reason || null,
      ],
    ).catch(err => this.logger.error('Audit log failed', err));
  }
}
