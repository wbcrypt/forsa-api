import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions } from '../common/decorators';
import { PaginationDto } from '../common/utils/pagination.util';

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  // T-101: self-service lookup for the logged-in student portal user.
  // Resolves via students.user_id keyed off the JWT identity — never trust
  // a client-supplied student id here. No @RequirePermissions(): a
  // self-registered student holds none of the staff `student.*` permission
  // grants, only PermissionsGuard's "no permissions required -> allow"
  // fallback lets this route through once JwtAuthGuard has validated the
  // token.
  @Get('me')
  @ApiOperation({ summary: 'Get the logged-in student portal user\'s own student profile (T-101)' })
  findMe(@CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.findMe(u, t);
  }

  // Discovered during manual pilot testing — no self-service profile edit
  // route existed at all; the Dashboard's "Complete Profile" checklist item
  // led to a read-only page with nothing to actually complete. Same
  // self-scoped pattern as findMe: resolves the student from the JWT
  // identity, never a client-supplied id.
  @Patch('me')
  @ApiOperation({ summary: "Update the logged-in student portal user's own profile" })
  updateMyProfile(@Body() dto: any, @CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.updateMyProfile(u, t, dto);
  }

  // T-219 — the pre-existing GET /:id/payments route (@RequirePermissions
  // 'payment.view', a staff-only permission) already spans every payment
  // across every application/financing period for a student, not just the
  // current one — exactly the "complete payment history end-to-end" data
  // T-219 asks for. It just wasn't reachable by an actual student portal
  // user, who holds none of the staff permission grants. Same self-scoped
  // pattern as findMe above: resolves via students.user_id off the JWT
  // identity, never a client-supplied id.
  @Get('me/payments')
  @ApiOperation({ summary: 'Get the logged-in student portal user\'s own complete payment history, across all applications (T-219)' })
  findMyPayments(@CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.findMyPayments(u, t);
  }

  // Phase 3 (browser E2E testing) discovery — HomePage.tsx has called
  // GET /:id/applications with user.id (not students.id) since it was
  // first built; that route is staff-only (student.view), so this has
  // 403'd for every real student since day one. Same self-scoped
  // pattern as findMe/findMyPayments above.
  @Get('me/applications')
  @ApiOperation({ summary: 'Get the logged-in student portal user\'s own application history' })
  findMyApplications(@CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.findMyApplications(u, t);
  }

  @Post()
  @RequirePermissions('student.create')
  create(@Body() dto: any, @CurrentTenant() t: string, @CurrentUser('id') u: string) {
    return this.service.create(dto, t, u);
  }

  @Get()
  @RequirePermissions('student.view')
  findAll(@CurrentTenant() t: string, @Query() p: PaginationDto, @Query() f: any) {
    return this.service.findAll(t, p, f);
  }

  @Get(':id')
  @RequirePermissions('student.view')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.findOne(id, t);
  }

  @Get(':id/pii')
  @RequirePermissions('student.view_pii')
  findOnePii(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.findOne(id, t, true);
  }

  @Patch(':id')
  @RequirePermissions('student.edit')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.update(id, t, dto, u);
  }

  @Get(':id/applications')
  @RequirePermissions('student.view')
  getApplicationHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.getApplicationHistory(id, t);
  }

  @Get(':id/payments')
  @RequirePermissions('payment.view')
  getPaymentHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.getPaymentHistory(id, t);
  }

  @Get(':id/exceptional-events')
  @RequirePermissions('exceptional_event.view')
  getExceptionalEvents(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.getExceptionalEvents(id, t);
  }

  @Post(':id/exceptional-events')
  @RequirePermissions('exceptional_event.open')
  openExceptionalEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.openExceptionalEvent(id, t, { ...dto, openedBy: u });
  }

  // Phase 10 — self-service guarantor invitation. Same self-scoped pattern
  // as findMe/findMyApplications: the studentId is resolved server-side
  // from the caller's own JWT, never trusted from the request. Closes the
  // "no manual admin intervention required" pilot blocker.
  @Post('me/guarantors')
  @ApiOperation({ summary: 'Invite a guarantor as the logged-in student, no staff action required' })
  addMyGuarantor(@Body() dto: any, @CurrentTenant() t: string, @CurrentUser('id') u: string) {
    return this.service.addMyGuarantor(u, t, dto);
  }

  @Post('me/guarantors/:guarantorId/resend-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Resend one of the logged-in student's own guarantor invitations" })
  resendMyGuarantorInvite(
    @Param('guarantorId', ParseUUIDPipe) guarantorId: string,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.resendMyGuarantorInvite(u, t, guarantorId);
  }

  @Post(':id/guarantors')
  @RequirePermissions('student.edit')
  addGuarantor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.addGuarantor(id, t, dto, u);
  }

  @Post(':id/guarantors/:guarantorId/resend-invite')
  @RequirePermissions('student.edit')
  @HttpCode(HttpStatus.OK)
  resendGuarantorInvite(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('guarantorId', ParseUUIDPipe) guarantorId: string,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.resendGuarantorInvite(id, guarantorId, t, u);
  }

  @Delete(':id/guarantors/:guarantorId')
  @RequirePermissions('student.edit')
  @HttpCode(HttpStatus.OK)
  withdrawGuarantor(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('guarantorId', ParseUUIDPipe) guarantorId: string,
    @Body() dto: { reason: string; reasonCode: string },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.withdrawGuarantor(id, guarantorId, t, dto.reason, dto.reasonCode, u);
  }
}
