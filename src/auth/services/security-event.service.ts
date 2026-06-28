import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SecurityEventType } from '../../common/enums';

interface SecurityEventParams {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  eventType: SecurityEventType;
  severity: 'info' | 'warning' | 'high' | 'critical';
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async log(params: SecurityEventParams): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO security_events
          (tenant_id, user_id, session_id, event_type, severity,
           ip_address, user_agent, endpoint, details, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
        [
          params.tenantId || null,
          params.userId || null,
          params.sessionId || null,
          params.eventType,
          params.severity,
          params.ipAddress || null,
          params.userAgent || null,
          params.endpoint || null,
          params.details ? JSON.stringify(params.details) : null,
        ],
      );

      if (params.severity === 'critical' || params.severity === 'high') {
        this.logger.warn(`Security event: ${params.eventType}`, {
          userId: params.userId,
          tenantId: params.tenantId,
          ip: params.ipAddress,
          severity: params.severity,
        });
      }
    } catch (err) {
      // Never let security logging failure bubble up
      this.logger.error('Failed to write security event', err);
    }
  }
}
