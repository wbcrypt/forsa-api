import { Entity, Column, Index } from 'typeorm';
import { AppendOnlyEntity } from '../../common/entities/base.entity';

@Entity('permissions')
export class Permission extends AppendOnlyEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100 })
  module: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'boolean', name: 'is_high_impact', default: false })
  isHighImpact: boolean;
}
