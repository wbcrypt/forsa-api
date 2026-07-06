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

  // T-223 discovery — the university portal was collecting "University ID"
  // as a raw, user-typed login-form field and trusting it client-side for
  // every subsequent "my university" API call (the same class of bug as
  // K-03/T-103's partners[0] issue, fixed in Phase 1, except worse: a
  // manually-typed field, not even an array index). Resolves via
  // universities.user_id keyed off the JWT identity — no
  // @RequirePermissions(): a university-portal user holds none of the
  // staff `university.*` permission grants. Registered before `:id` so
  // 'me' is never swallowed as a param value.
  @Get('me')
  @ApiOperation({ summary: "Get the logged-in university portal user's own university (T-223 identity fix)" })
  findMe(@CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.findMe(u, t);
  }

  // Phase 3 (browser E2E testing) discovery — see universities.service
  // .ts's getMyPerformance comment: the dashboard's performance stats
  // call was staff-only and 403'd for every real university account.
  @Get('me/performance')
  @ApiOperation({ summary: "Get the logged-in university portal user's own performance stats" })
  getMyPerformance(@CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.getMyPerformance(u, t);
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

  // Phase 3 (browser E2E testing) discovery — the Financing Request
  // form's program dropdown called the staff-only GET /:id/programs and
  // 403'd for every real student. Registered before ':id/programs' so
  // ':id/programs/public' isn't swallowed by the ':id' param route
  // matching 'public' as an id — same reasoning as 'public' above.
  @Get(':id/programs/public')
  @ApiOperation({ summary: 'Public minimal program list for a university, for the Financing Request form' })
  findProgramsPublic(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return this.service.findProgramsPublic(id, tenantId);
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

  // T-223 discovery — staff-facing linkage, since no university-portal
  // self-registration flow exists to establish this on its own.
  @Patch(':id/link-user')
  @RequirePermissions('university.edit')
  linkUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { userId: string },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.linkUser(id, body.userId, t, u);
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
