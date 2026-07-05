import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UniversitiesService } from './universities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions, Public } from '../common/decorators';
import { PaginationDto } from '../common/utils/pagination.util';

@ApiTags('Universities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('universities')
export class UniversitiesController {
  constructor(private readonly service: UniversitiesService) {}

  @Post()
  @RequirePermissions('university.create')
  create(@Body() dto: any, @CurrentTenant() t: string, @CurrentUser('id') u: string) {
    return this.service.create(dto, t, u);
  }

  @Get()
  @RequirePermissions('university.view')
  findAll(@CurrentTenant() t: string, @Query() p: PaginationDto, @Query() f: any) {
    return this.service.findAll(t, p, f);
  }

  // Phase 2 T-203 — genuinely public, minimal projection (id/name/city
  // only), so the anonymous Membership Request form can offer a real
  // university picker rather than free text. Registered before `:id` so
  // 'public' is never swallowed as a param value.
  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Public minimal university list for the Membership Request form (T-203)' })
  findAllPublic(@Query('tenantId') tenantId: string) {
    return this.service.findAllPublic(tenantId);
  }

  @Get(':id')
  @RequirePermissions('university.view')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.findOne(id, t);
  }

  @Patch(':id')
  @RequirePermissions('university.edit')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.update(id, t, dto, u);
  }

  @Get(':id/performance')
  @RequirePermissions('university.view')
  getPerformance(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.getPerformance(id, t);
  }

  // Programs
  @Post(':id/programs')
  @RequirePermissions('university.edit')
  createProgram(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @CurrentTenant() t: string,
  ) {
    return this.service.createProgram(id, t, dto);
  }

  @Get(':id/programs')
  @RequirePermissions('university.view')
  findPrograms(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.findPrograms(id, t);
  }

  // Contacts
  @Post(':id/contacts')
  @RequirePermissions('university.edit')
  addContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @CurrentTenant() t: string,
  ) {
    return this.service.addContact(id, t, dto);
  }

  // Agreements
  @Post(':id/agreements')
  @RequirePermissions('university.agreement.create')
  createAgreement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.createAgreement(id, t, dto, u);
  }

  @Post('agreements/:agreementId/approve')
  @RequirePermissions('university.agreement.approve')
  @HttpCode(HttpStatus.OK)
  approveAgreement(
    @Param('agreementId', ParseUUIDPipe) id: string,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.approveAgreement(id, t, u);
  }

  // Business Continuity
  @Post(':id/business-continuity')
  @RequirePermissions('exceptional_event.open')
  @HttpCode(HttpStatus.OK)
  initiateBusinessContinuity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.initiateBusinessContinuity(id, t, dto, u);
  }
}
