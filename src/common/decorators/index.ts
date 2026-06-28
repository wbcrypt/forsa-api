import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  applyDecorators,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';

// ============================================================
// Current User Decorator
// ============================================================
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// ============================================================
// Current Tenant Decorator
// ============================================================
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId || request.user?.tenantId;
  },
);

// ============================================================
// Permissions Decorator
// ============================================================
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// ============================================================
// Public Route Decorator (skips JWT auth)
// ============================================================
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// ============================================================
// High Impact Action Decorator (requires extra audit)
// ============================================================
export const IS_HIGH_IMPACT_KEY = 'isHighImpact';
export const HighImpact = () => SetMetadata(IS_HIGH_IMPACT_KEY, true);

// ============================================================
// Audit Reason Decorator (requires reason in request body)
// ============================================================
export const REQUIRES_AUDIT_REASON_KEY = 'requiresAuditReason';
export const RequiresAuditReason = () => SetMetadata(REQUIRES_AUDIT_REASON_KEY, true);

// ============================================================
// IP Address Decorator
// ============================================================
export const ClientIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return (
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  },
);

// ============================================================
// User Agent Decorator
// ============================================================
export const UserAgent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['user-agent'] || 'unknown';
  },
);
