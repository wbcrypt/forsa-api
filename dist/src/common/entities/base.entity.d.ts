export declare abstract class BaseEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare abstract class TenantScopedEntity extends BaseEntity {
    tenantId: string;
}
export declare abstract class AppendOnlyEntity {
    id: string;
    createdAt: Date;
}
