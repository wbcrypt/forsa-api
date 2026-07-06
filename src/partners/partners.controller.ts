import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PartnersService } from './partners.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions } from '../common/decorators';
import { PaginationDto } from '../common/utils/pagination.util';
import { CommissionStatus } from '../common/enums';

@ApiTags('Partners & Referrals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('partners')
export class PartnersController {
  constructor(private readonly service: PartnersService) {}

  @Post()
  @RequirePermissions('partner.create')
  create(@Body() dto: any, @CurrentTenant() t: string, @CurrentUser('id') u: string) {
    return this.service.create(dto, t, u);
  }

  @Get()
  @RequirePermissions('partner.view')
  findAll(@CurrentTenant() t: string, @Query() p: PaginationDto) {
    return this.service.findAll(t, p);
  }

  @Get('commissions')
  @RequirePermissions('partner.commission.approve')
  getCommissions(@CurrentTenant() t: string, @Query() p: PaginationDto, @Query() f: any) {
    return this.service.getCommissions(t, f, p);
  }

  // T-103: JWT-scoped identity route — resolves the partner from the
  // authenticated user's own account, never from a client-supplied id.
  // Must stay registered before ':id' below so 'me' doesn't get swallowed
  // by the ':id' param route. No @RequirePermissions() — a partner portal
  // login may hold zero staff permissions; only JwtAuthGuard is required.
  @Get('me')
  getMe(@CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.findMe(u, t);
  }

  // T-224 discovery — same JWT-scoped-identity pattern as 'me' above.
  // Must also stay registered before ':id'.
  @Get('me/applications')
  @ApiOperation({ summary: "List the logged-in partner's own referred applications (T-224 identity fix)" })
  getMyApplications(@CurrentUser('id') u: string, @CurrentTenant() t: string, @Query() p: PaginationDto) {
    return this.service.getMyApplications(u, t, p);
  }

  // T-224 discovery — same pattern: getDashboard(':id') requires the
  // staff-only partner.view permission, which no partner-portal account
  // holds — 403'd unconditionally for the portal's own dashboard.
  @Get('me/dashboard')
  getMyDashboard(@CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.getMyDashboard(u, t);
  }

  // T-224 discovery — see partners.service.ts's getMyCommissions comment:
  // the staff GET /partners/commissions both 403'd for partner accounts
  // and, independent of that, never filtered by partner_id at all.
  @Get('me/commissions')
  getMyCommissions(@CurrentUser('id') u: string, @CurrentTenant() t: string, @Query() p: PaginationDto) {
    return this.service.getMyCommissions(u, t, p);
  }

  // T-224 discovery — no PATCH route for partners existed at all before
  // this; profile editing was completely non-functional (404), not just
  // an identity-trust gap.
  @Patch('me')
  updateMe(
    @CurrentUser('id') u: string,
    @CurrentTenant() t: string,
    @Body() body: { name?: string; website?: string },
  ) {
    return this.service.updateMe(u, t, body);
  }

  @Get(':id')
  @RequirePermissions('partner.view')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.findOne(id, t);
  }

  @Get(':id/dashboard')
  @RequirePermissions('partner.view')
  getDashboard(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.getPartnerDashboard(id, t);
  }

  @Post(':id/agreements')
  @RequirePermissions('partner.edit')
  createAgreement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.createAgreement(id, t, dto, u);
  }

  @Post('commissions/:id/advance')
  @RequirePermissions('partner.commission.approve')
  @HttpCode(HttpStatus.OK)
  advanceCommission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { newStatus: CommissionStatus },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.advanceCommissionStatus(id, t, body.newStatus, u);
  }
}
