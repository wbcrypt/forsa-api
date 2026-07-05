import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions, Public } from '../common/decorators';
import { PaginationDto } from '../common/utils/pagination.util';
import { RegisterStudentDto } from './dto/register-student.dto';

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  // T-101: genuinely public self-registration — @Public() overrides the
  // class-level JwtAuthGuard for this route only. No @RequirePermissions()
  // either, since there is no authenticated user yet. Must stay registered
  // before the generic POST '' create route is reached by routing (Nest
  // matches literal path segments before this bare POST, so 'register' as
  // a sibling path segment, not a param, is unambiguous either order — kept
  // here for readability next to the class-scoped CRUD create route).
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Public self-registration — creates a students row and a real users/auth row in one transaction (T-101)' })
  registerSelf(@Body() dto: RegisterStudentDto) {
    return this.service.registerSelf(dto);
  }

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
