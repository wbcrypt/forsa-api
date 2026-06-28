import { Entity, Column, Index } from 'typeorm';
import { AppendOnlyEntity } from '../../common/entities/base.entity';

@Entity('user_sessions')
@Index(['sessionTokenHash'], { unique: true })
@Index(['userId'])
export class UserSession extends AppendOnlyEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'text', name: 'session_token_hash', unique: true })
  sessionTokenHash: string;

  @Column({ type: 'inet', name: 'ip_address' })
  ipAddress: string;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'text', name: 'device_fingerprint', nullable: true })
  deviceFingerprint: string | null;

  @Column({ type: 'timestamptz', name: 'last_active_at' })
  lastActiveAt: Date;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', name: 'invalidated_at', nullable: true })
  invalidatedAt: Date | null;

  @Column({ type: 'varchar', length: 100, name: 'invalidation_reason', nullable: true })
  invalidationReason: string | null;

  get isValid(): boolean {
    return !this.invalidatedAt && this.expiresAt > new Date();
  }
}
