import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentTenant, RequirePermissions } from '../common/decorators';

@ApiTags('Reports & Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('ceo')
  @RequirePermissions('report.ceo')
  @ApiOperation({ summary: 'CEO overview dashboard' })
  getCeo(@CurrentTenant() t: string) {
    return this.service.getCeoDashboard(t);
  }

  @Get('finance')
  @RequirePermissions('report.finance')
  @ApiOperation({ summary: 'Finance dashboard — ledger, receivables, disbursements' })
  getFinance(@CurrentTenant() t: string) {
    return this.service.getFinanceDashboard(t);
  }

  @Get('sales')
  @RequirePermissions('report.sales')
  @ApiOperation({ summary: 'Sales funnel, conversion rates, team performance' })
  getSales(@CurrentTenant() t: string) {
    return this.service.getSalesDashboard(t);
  }

  @Get('collections')
  @RequirePermissions('report.collections')
  @ApiOperation({ summary: 'Collections dashboard — aging, overdue, risk buckets' })
  getCollections(@CurrentTenant() t: string) {
    return this.service.getCollectionsDashboard(t);
  }

  @Get('partners')
  @RequirePermissions('report.partners')
  @ApiOperation({ summary: 'Partner referral and commission report' })
  getPartners(@CurrentTenant() t: string) {
    return this.service.getPartnerDashboard(t);
  }

  @Get('audit')
  @RequirePermissions('report.audit')
  @ApiOperation({ summary: 'Full audit log report' })
  getAudit(
    @CurrentTenant() t: string,
    @Query('module') module?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: number,
  ) {
    return this.service.getAuditReport(t, { module, userId, from, to, limit });
  }
}
