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
export declare class SecurityEventService {
    private readonly dataSource;
    private readonly logger;
    constructor(dataSource: DataSource);
    log(params: SecurityEventParams): Promise<void>;
}
export {};
