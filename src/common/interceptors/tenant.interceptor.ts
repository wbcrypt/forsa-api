import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.tenantId) {
      // Set PostgreSQL session variable for RLS policies
      // Using SET (not SET LOCAL) so it persists for the connection's queries
      await this.dataSource.query(
        `SELECT set_config('app.current_tenant_id', $1, false)`,
        [user.tenantId],
      ).catch(() => {}); // Don't break requests if this fails
      request.tenantId = user.tenantId;
    }

    return next.handle();
  }
}
