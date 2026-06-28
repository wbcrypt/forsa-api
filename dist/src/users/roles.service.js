"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var RolesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const role_entity_1 = require("./entities/role.entity");
const permission_entity_1 = require("./entities/permission.entity");
let RolesService = RolesService_1 = class RolesService {
    constructor(roleRepository, permissionRepository, dataSource) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(RolesService_1.name);
    }
    async findAllRoles(tenantId) {
        return this.roleRepository.find({
            where: { tenantId, status: 'active' },
            order: { name: 'ASC' },
        });
    }
    async findAllPermissions() {
        return this.permissionRepository.find({ order: { module: 'ASC', action: 'ASC' } });
    }
    async createRole(tenantId, name, description, createdBy) {
        const existing = await this.roleRepository.findOne({ where: { tenantId, name } });
        if (existing)
            throw new common_1.ConflictException('Role with this name already exists');
        const role = this.roleRepository.create({ tenantId, name, description, createdBy });
        return this.roleRepository.save(role);
    }
    async assignPermissionsToRole(roleId, tenantId, permissionCodes, grantedBy) {
        const role = await this.roleRepository.findOne({ where: { id: roleId, tenantId } });
        if (!role)
            throw new common_1.NotFoundException('Role not found');
        if (role.isSystemRole) {
            throw new common_1.BadRequestException('Cannot modify system role permissions');
        }
        const permissions = await this.permissionRepository.findBy(permissionCodes.map(code => ({ code })));
        for (const permission of permissions) {
            await this.dataSource.query(`INSERT INTO role_permissions (role_id, permission_id, granted_by, granted_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (role_id, permission_id) DO NOTHING`, [roleId, permission.id, grantedBy]);
        }
    }
    async getRolePermissions(roleId, tenantId) {
        const role = await this.roleRepository.findOne({ where: { id: roleId, tenantId } });
        if (!role)
            throw new common_1.NotFoundException('Role not found');
        return this.dataSource.query(`SELECT p.code, p.module, p.action, p.description, p.is_high_impact
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1
       ORDER BY p.module, p.action`, [roleId]);
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = RolesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(role_entity_1.Role)),
    __param(1, (0, typeorm_1.InjectRepository)(permission_entity_1.Permission)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], RolesService);
//# sourceMappingURL=roles.service.js.map