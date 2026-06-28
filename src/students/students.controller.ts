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
