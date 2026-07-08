import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions } from '../common/decorators';
import { PaginationDto } from '../common/utils/pagination.util';
import { ApplicationStatus } from '../common/enums';
import { TransitionStatusDto } from './dto/transition-status.dto';
import { ScheduleMeetingDto, UpdateMeetingStatusDto } from './dto/meeting.dto';

@ApiTags('Applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Post()
  @RequirePermissions('application.create')
  @ApiOperation({ summary: 'Create a new application / lead (staff CRM path)' })
  create(@Body() dto: any, @CurrentTenant() t: string, @CurrentUser('id') u: string) {
    return this.service.create(dto, t, u);
  }

  // T-207 — the route the student portal actually calls. No
  // @RequirePermissions(): a self-registered student holds none of the
  // staff `application.*` grants (no role is ever assigned to those
  // accounts) — same "no permissions required -> PermissionsGuard allows
  // it through" pattern as GET /students/me. Registered before any
  // param-shaped routes for clarity, though 'me' as a literal POST
  // sub-path has no :id sibling to collide with here.
  @Post('me')
  @ApiOperation({ summary: 'Submit a Financing Request as the logged-in student (T-207, gated on active membership)' })
  createForSelf(@Body() dto: any, @CurrentTenant() t: string, @CurrentUser('id') u: string) {
    return this.service.createForSelf(u, t, dto);
  }

  // Phase 3 (browser E2E testing) discovery — see applications.service
  // .ts's findAllForMyUniversity comment. No @RequirePermissions(): a
  // university-portal account holds none of the staff grants, same
  // pattern as every other self-scoped route in this codebase.
  @Get('university-mine')
  @ApiOperation({ summary: "List the logged-in university portal user's own applications" })
  findAllForMyUniversity(@CurrentUser('id') u: string, @CurrentTenant() t: string, @Query() p: PaginationDto, @Query() f: any) {
    return this.service.findAllForMyUniversity(u, t, p, f);
  }

  @Get('university-mine/:id')
  @ApiOperation({ summary: "Get one of the logged-in university portal user's own application's detail" })
  findOneForMyUniversity(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.findOneForMyUniversity(u, t, id);
  }

  @Get('university-mine/:id/status-history')
  @ApiOperation({ summary: "Get one of the logged-in university portal user's own application's status history" })
  getStatusHistoryForMyUniversity(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.getStatusHistoryForMyUniversity(u, t, id);
  }

  @Get('me/:id/status-history')
  @ApiOperation({ summary: "Get the logged-in student's own application's status history" })
  getStatusHistoryForMe(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.getStatusHistoryForMe(u, t, id);
  }

  // Phase 10 — Waiting List Experience (FORSA_OPERATIONS_MANUAL.md §3).
  @Get('me/:id/queue-position')
  @ApiOperation({ summary: "Get the logged-in student's own application's estimated waiting-list position" })
  getQueuePositionForMe(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.getQueuePositionForMe(u, t, id);
  }

  // Workflow architecture redesign — the Student Timeline view (plain-
  // language customer-journey milestones), distinct from the Admin
  // Pipeline view GET /applications/:id returns to staff.
  @Get('me/:id/timeline')
  @ApiOperation({ summary: "Get the logged-in student's own application's customer-journey timeline" })
  getMyApplicationTimeline(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.getMyApplicationTimeline(u, t, id);
  }

  @Get()
  @RequirePermissions('application.view')
  @ApiOperation({ summary: 'List applications with filters' })
  findAll(@CurrentTenant() t: string, @Query() p: PaginationDto, @Query() f: any) {
    return this.service.findAll(t, p, f);
  }

  @Get(':id')
  @RequirePermissions('application.view')
  @ApiOperation({ summary: 'Get full application detail, including the admin completeness checklist' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.findOneForAdmin(id, t);
  }

  @Get(':id/pipeline-history')
  @RequirePermissions('application.view')
  @ApiOperation({ summary: 'Get all pipeline runs for this application' })
  getPipelineHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.getPipelineHistory(id, t);
  }

  @Get(':id/status-history')
  @RequirePermissions('application.view')
  @ApiOperation({ summary: 'Get full status transition history' })
  getStatusHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.getStatusHistory(id, t);
  }

  // Phase 13 (Case Management & Dual Applicant Workflow) — "Admin now
  // reviews the COMPLETE CASE": student summary, guarantor summary,
  // documents, AI analysis, completeness, risk flags, timeline, meeting
  // status, all in one response. Reuses application.view — no new
  // permission introduced, per this phase's explicit constraints.
  @Get(':id/case')
  @RequirePermissions('application.view')
  @ApiOperation({ summary: 'Get the complete Case Summary — student + guarantor + documents + AI analysis + meeting + payments' })
  getCaseSummary(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.getCaseSummary(id, t);
  }

  @Post(':id/meetings')
  @RequirePermissions('application.edit')
  @ApiOperation({ summary: 'Schedule the Case activation meeting (after approval in principle)' })
  scheduleMeeting(
    @Param('id', ParseUUIDPipe) id: string, @Body() dto: ScheduleMeetingDto,
    @CurrentTenant() t: string, @CurrentUser('id') u: string,
  ) {
    return this.service.scheduleMeeting(id, t, dto, u);
  }

  @Patch('meetings/:meetingId')
  @RequirePermissions('application.edit')
  @ApiOperation({ summary: 'Confirm, complete, reschedule, or cancel a Case activation meeting' })
  updateMeetingStatus(
    @Param('meetingId', ParseUUIDPipe) meetingId: string, @Body() dto: UpdateMeetingStatusDto,
    @CurrentTenant() t: string,
  ) {
    return this.service.updateMeetingStatus(meetingId, t, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('application.edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually transition application status' })
  transitionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionStatusDto,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.transitionStatus(id, t, body.status, u, body.notes, undefined, body.financingTier);
  }

  // T-223 — the university portal's one write capability. No
  // @RequirePermissions(): a university-portal user holds none of the
  // staff `application.*` grants (same pattern as the student portal's
  // self-scoped routes) — confirmEnrollment does its own scoping check
  // server-side via universitiesService.findMe, never trusting anything
  // client-supplied.
  @Post(':id/university-confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "University portal confirms enrollment/tuition for one of its own students' applications" })
  confirmEnrollment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { notes?: string },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.confirmEnrollment(id, t, u, body?.notes);
  }

  @Patch(':id/assign')
  @RequirePermissions('application.assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign application to a staff member' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { userId: string },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.assignTo(id, t, body.userId, u);
  }

  @Post(':id/appeal')
  @RequirePermissions('application.appeal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit appeal for a rejected application' })
  submitAppeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.submitAppeal(id, t, dto, u);
  }
}
