import { Entity, Column, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/base.entity';

@Entity('roles')
@Index(['tenantId', 'name'], { unique: true })
export class Role extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', name: 'is_system_role', default: false })
  isSystemRole: boolean;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;
}
