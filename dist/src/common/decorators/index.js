"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAgent = exports.ClientIp = exports.RequiresAuditReason = exports.REQUIRES_AUDIT_REASON_KEY = exports.HighImpact = exports.IS_HIGH_IMPACT_KEY = exports.Public = exports.IS_PUBLIC_KEY = exports.RequirePermissions = exports.PERMISSIONS_KEY = exports.CurrentTenant = exports.CurrentUser = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentUser = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
});
exports.CurrentTenant = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId || request.user?.tenantId;
});
exports.PERMISSIONS_KEY = 'permissions';
const RequirePermissions = (...permissions) => (0, common_1.SetMetadata)(exports.PERMISSIONS_KEY, permissions);
exports.RequirePermissions = RequirePermissions;
exports.IS_PUBLIC_KEY = 'isPublic';
const Public = () => (0, common_1.SetMetadata)(exports.IS_PUBLIC_KEY, true);
exports.Public = Public;
exports.IS_HIGH_IMPACT_KEY = 'isHighImpact';
const HighImpact = () => (0, common_1.SetMetadata)(exports.IS_HIGH_IMPACT_KEY, true);
exports.HighImpact = HighImpact;
exports.REQUIRES_AUDIT_REASON_KEY = 'requiresAuditReason';
const RequiresAuditReason = () => (0, common_1.SetMetadata)(exports.REQUIRES_AUDIT_REASON_KEY, true);
exports.RequiresAuditReason = RequiresAuditReason;
exports.ClientIp = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return (request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        request.headers['x-real-ip'] ||
        request.connection?.remoteAddress ||
        request.ip ||
        'unknown');
});
exports.UserAgent = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['user-agent'] || 'unknown';
});
//# sourceMappingURL=index.js.map