import {
  Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExecutionService } from './execution.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions } from '../common/decorators';
import { generateIdempotencyKey } from '../common/utils/encryption.util';

@ApiTags('Decision Execution Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('execution')
export class ExecutionController {
  constructor(private readonly service: ExecutionService) {}

  @Post()
  @RequirePermissions('execution.submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an action for execution through the DEE (idempotent)' })
  execute(
    @Body() body: { executionId?: string; actionType: string; payload: any },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.execute({
      executionId: body.executionId || generateIdempotencyKey('exec'),
      tenantId: t,
      actionType: body.actionType,
      payload: body.payload,
      requestedBy: u,
    });
  }

  @Get('history')
  @RequirePermissions('execution.view')
  @ApiOperation({ summary: 'View execution ledger history (immutable)' })
  getHistory(@CurrentTenant() t: string, @Query('limit') limit: number) {
    return this.service.getExecutionHistory(t, limit || 50);
  }

  // T-222 — Finance portal's Disbursements page (read-only; execution
  // itself remains admin-portal/DEE only).
  @Get('disbursements')
  @RequirePermissions('execution.view')
  @ApiOperation({ summary: 'View university disbursement history' })
  getDisbursements(@CurrentTenant() t: string, @Query('limit') limit: number) {
    return this.service.getDisbursements(t, limit || 100);
  }
}
