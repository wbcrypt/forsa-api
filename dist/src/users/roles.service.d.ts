import { Repository, DataSource } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
export declare class RolesService {
    private readonly roleRepository;
    private readonly permissionRepository;
    private readonly dataSource;
    private readonly logger;
    constructor(roleRepository: Repository<Role>, permissionRepository: Repository<Permission>, dataSource: DataSource);
    findAllRoles(tenantId: string): Promise<Role[]>;
    findAllPermissions(): Promise<Permission[]>;
    createRole(tenantId: string, name: string, description: string, createdBy: string): Promise<Role>;
    assignPermissionsToRole(roleId: string, tenantId: string, permissionCodes: string[], grantedBy: string): Promise<void>;
    getRolePermissions(roleId: string, tenantId: string): Promise<any>;
}
