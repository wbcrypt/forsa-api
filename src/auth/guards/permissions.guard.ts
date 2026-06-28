import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PERMISSIONS_KEY } from '../../common/decorators';
import { SecurityEventType } from '../../common/enums';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permissions required — allow through
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check permissions from JWT payload (already loaded at login)
    const userPermissions: string[] = user.permissions || [];
    const hasPermission = requiredPermissions.every(p =>
      userPermissions.includes(p),
    );

    if (!hasPermission) {
      // Log permission denial as security event
      await this.dataSource.query(
        `INSERT INTO security_events
          (tenant_id, user_id, event_type, severity, ip_address, endpoint, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          user.tenantId,
          user.id,
          SecurityEventType.PERMISSION_DENIED,
          'warning',
          request.ip,
          `${request.method} ${request.url}`,
          JSON.stringify({
            required: requiredPermissions,
            userHas: userPermissions,
          }),
        ],
      ).catch(err => this.logger.error('Failed to log permission denial', err));

      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
