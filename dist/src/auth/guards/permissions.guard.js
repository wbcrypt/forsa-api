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
var PermissionsGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const decorators_1 = require("../../common/decorators");
const enums_1 = require("../../common/enums");
let PermissionsGuard = PermissionsGuard_1 = class PermissionsGuard {
    constructor(reflector, dataSource) {
        this.reflector = reflector;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(PermissionsGuard_1.name);
    }
    async canActivate(context) {
        const requiredPermissions = this.reflector.getAllAndOverride(decorators_1.PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new common_1.ForbiddenException('Authentication required');
        }
        const userPermissions = user.permissions || [];
        const hasPermission = requiredPermissions.every(p => userPermissions.includes(p));
        if (!hasPermission) {
            await this.dataSource.query(`INSERT INTO security_events
          (tenant_id, user_id, event_type, severity, ip_address, endpoint, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`, [
                user.tenantId,
                user.id,
                enums_1.SecurityEventType.PERMISSION_DENIED,
                'warning',
                request.ip,
                `${request.method} ${request.url}`,
                JSON.stringify({
                    required: requiredPermissions,
                    userHas: userPermissions,
                }),
            ]).catch(err => this.logger.error('Failed to log permission denial', err));
            throw new common_1.ForbiddenException(`Insufficient permissions. Required: ${requiredPermissions.join(', ')}`);
        }
        return true;
    }
};
exports.PermissionsGuard = PermissionsGuard;
exports.PermissionsGuard = PermissionsGuard = PermissionsGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [core_1.Reflector,
        typeorm_2.DataSource])
], PermissionsGuard);
//# sourceMappingURL=permissions.guard.js.map