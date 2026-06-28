import {
  Entity,
  Column,
  Index,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { TenantScopedEntity } from '../../common/entities/base.entity';
import { UserStatus } from '../../common/enums';

@Entity('users')
@Index(['tenantId', 'email'], { unique: true })
@Index(['tenantId', 'status'])
export class User extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 255, name: 'email' })
  email: string;

  @Column({ type: 'boolean', name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ type: 'text', name: 'password_hash' })
  @Exclude()
  passwordHash: string;

  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName: string;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'status',
    default: UserStatus.PENDING_VERIFICATION,
    enum: Object.values(UserStatus),
  })
  status: UserStatus;

  @Column({ type: 'boolean', name: 'mfa_enabled', default: false })
  mfaEnabled: boolean;

  @Column({ type: 'int', name: 'failed_login_attempts', default: 0 })
  @Exclude()
  failedLoginAttempts: number;

  @Column({ type: 'timestamptz', name: 'locked_until', nullable: true })
  @Exclude()
  lockedUntil: Date | null;

  @Column({ type: 'timestamptz', name: 'last_login_at', nullable: true })
  lastLoginAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'password_changed_at',
    default: () => 'NOW()',
  })
  @Exclude()
  passwordChangedAt: Date;

  @Column({ type: 'boolean', name: 'must_change_password', default: false })
  mustChangePassword: boolean;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', name: 'deactivated_by', nullable: true })
  deactivatedBy: string | null;

  @Column({ type: 'timestamptz', name: 'deactivated_at', nullable: true })
  deactivatedAt: Date | null;

  // Computed helpers (not stored)
  get isActive(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  get isLocked(): boolean {
    return this.lockedUntil != null && this.lockedUntil > new Date();
  }
}
