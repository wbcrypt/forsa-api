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
