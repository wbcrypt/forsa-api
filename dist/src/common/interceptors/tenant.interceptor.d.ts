import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';
export declare class TenantInterceptor implements NestInterceptor {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>>;
}
