import {
  Injectable, NotFoundException, ConflictException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly dataSource: DataSource,
  ) {}

  async findAllRoles(tenantId: string) {
    return this.roleRepository.find({
      where: { tenantId, status: 'active' },
      order: { name: 'ASC' },
    });
  }

  async findAllPermissions() {
    return this.permissionRepository.find({ order: { module: 'ASC', action: 'ASC' } });
  }

  async createRole(
    tenantId: string,
    name: string,
    description: string,
    createdBy: string,
  ): Promise<Role> {
    const existing = await this.roleRepository.findOne({ where: { tenantId, name } });
    if (existing) throw new ConflictException('Role with this name already exists');

    const role = this.roleRepository.create({ tenantId, name, description, createdBy });
    return this.roleRepository.save(role);
  }

  async assignPermissionsToRole(
    roleId: string,
    tenantId: string,
    permissionCodes: string[],
    grantedBy: string,
  ): Promise<void> {
    const role = await this.roleRepository.findOne({ where: { id: roleId, tenantId } });
    if (!role) throw new NotFoundException('Role not found');

    if (role.isSystemRole) {
      throw new BadRequestException('Cannot modify system role permissions');
    }

    const permissions = await this.permissionRepository.findBy(
      permissionCodes.map(code => ({ code })),
    );

    for (const permission of permissions) {
      await this.dataSource.query(
        `INSERT INTO role_permissions (role_id, permission_id, granted_by, granted_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [roleId, permission.id, grantedBy],
      );
    }
  }

  async getRolePermissions(roleId: string, tenantId: string) {
    const role = await this.roleRepository.findOne({ where: { id: roleId, tenantId } });
    if (!role) throw new NotFoundException('Role not found');

    return this.dataSource.query(
      `SELECT p.code, p.module, p.action, p.description, p.is_high_impact
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1
       ORDER BY p.module, p.action`,
      [roleId],
    );
  }
}
