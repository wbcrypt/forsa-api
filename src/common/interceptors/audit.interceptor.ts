import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export const AUDIT_ACTION_KEY = 'audit_action';
export const AUDIT_ENTITY_KEY = 'audit_entity';

export function AuditLog(action: string, entity: string) {
  return function (target: any, key?: any, descriptor?: any) {
    Reflect.defineMetadata(AUDIT_ACTION_KEY, action, descriptor.value);
    Reflect.defineMetadata(AUDIT_ENTITY_KEY, entity, descriptor.value);
    return descriptor;
  };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();

    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, handler);
    const entity = this.reflector.get<string>(AUDIT_ENTITY_KEY, handler);

    if (!action || !entity) {
      return next.handle();
    }

    const startTime = Date.now();
    const user = request.user;
    const tenantId = request.tenantId;

    return next.handle().pipe(
      tap({
        next: async (responseData) => {
          try {
            await this.writeAuditLog({
              tenantId,
              userId: user?.id,
              sessionId: user?.sessionId,
              actionType: action,
              module: entity.split('.')[0],
              targetEntity: entity,
              targetId: responseData?.id || request.params?.id,
              newValue: this.sanitizeForAudit(responseData),
              ipAddress: request.ip,
              deviceFingerprint: request.headers['x-device-fingerprint'],
              reason: request.body?.auditReason,
            });
          } catch (err) {
            // Never let audit logging failure break the main request
            this.logger.error('Audit log write failed', err);
          }
        },
        error: (err) => {
          this.logger.warn(`Action failed: ${action} on ${entity}`, {
            userId: user?.id,
            error: err.message,
          });
        },
      }),
    );
  }

  private sanitizeForAudit(data: any): any {
    if (!data) return null;
    // Remove sensitive fields from audit log values
    const sanitized = { ...data };
    const sensitiveFields = ['passwordHash', 'password', 'secretEncrypted', 'mfaSecret'];
    sensitiveFields.forEach(field => delete sanitized[field]);
    return sanitized;
  }

  private async writeAuditLog(entry: {
    tenantId?: string;
    userId?: string;
    sessionId?: string;
    actionType: string;
    module: string;
    targetEntity: string;
    targetId?: string;
    previousValue?: any;
    newValue?: any;
    ipAddress?: string;
    deviceFingerprint?: string;
    reason?: string;
  }): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO audit_logs
        (tenant_id, user_id, session_id, action_type, module, target_entity, target_id,
         previous_value, new_value, ip_address, device_fingerprint, reason, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())`,
      [
        entry.tenantId,
        entry.userId,
        entry.sessionId,
        entry.actionType,
        entry.module,
        entry.targetEntity,
        entry.targetId,
        entry.previousValue ? JSON.stringify(entry.previousValue) : null,
        entry.newValue ? JSON.stringify(entry.newValue) : null,
        entry.ipAddress,
        entry.deviceFingerprint,
        entry.reason,
      ],
    );
  }
}
