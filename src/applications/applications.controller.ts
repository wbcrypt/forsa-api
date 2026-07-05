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

@ApiTags('Applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Post()
  @RequirePermissions('application.create')
  @ApiOperation({ summary: 'Create a new application / lead' })
  create(@Body() dto: any, @CurrentTenant() t: string, @CurrentUser('id') u: string) {
    return this.service.create(dto, t, u);
  }

  @Get()
  @RequirePermissions('application.view')
  @ApiOperation({ summary: 'List applications with filters' })
  findAll(@CurrentTenant() t: string, @Query() p: PaginationDto, @Query() f: any) {
    return this.service.findAll(t, p, f);
  }

  @Get(':id')
  @RequirePermissions('application.view')
  @ApiOperation({ summary: 'Get full application detail' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.findOne(id, t);
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
    return this.service.transitionStatus(id, t, body.status, u, body.notes);
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
