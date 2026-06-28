import { TenantScopedEntity } from '../../common/entities/base.entity';
export declare class Role extends TenantScopedEntity {
    name: string;
    description: string | null;
    isSystemRole: boolean;
    status: string;
    createdBy: string | null;
}
