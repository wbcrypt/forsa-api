import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
export declare const AUDIT_ACTION_KEY = "audit_action";
export declare const AUDIT_ENTITY_KEY = "audit_entity";
export declare function AuditLog(action: string, entity: string): (target: any, key?: any, descriptor?: any) => any;
export declare class AuditInterceptor implements NestInterceptor {
    private readonly reflector;
    private readonly dataSource;
    private readonly logger;
    constructor(reflector: Reflector, dataSource: DataSource);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
    private sanitizeForAudit;
    private writeAuditLog;
}
