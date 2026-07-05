import {
  Controller, Get, Post, Body, Param, Query, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MembershipService } from './membership.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions, Public } from '../common/decorators';
import { CreateMembershipRequestDto } from './dto/create-membership-request.dto';
import { RejectMembershipRequestDto } from './dto/reject-membership-request.dto';

@ApiTags('Membership')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('membership-requests')
export class MembershipController {
  constructor(private readonly service: MembershipService) {}

  // T-203 — genuinely public intake, no auth, no permission check.
  @Public()
  @Post()
  @ApiOperation({ summary: 'Public Membership Request intake (Visitor -> Membership Request, Phase 2 T-203)' })
  create(@Body() dto: CreateMembershipRequestDto) {
    return this.service.createRequest(dto);
  }

  @Get()
  @RequirePermissions('membership.view')
  @ApiOperation({ summary: 'List membership requests (Admin Dashboard Membership Queue)' })
  findAll(@CurrentTenant() t: string, @Query('status') status?: string) {
    return this.service.findAll(t, status);
  }

  @Get(':id')
  @RequirePermissions('membership.view')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.findOne(id, t);
  }

  // T-204 — on approval: provisions students + users row, issues Bronze,
  // emails a set-password link (never invents a password, D-001).
  @Post(':id/approve')
  @RequirePermissions('membership.approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a membership request — issues Bronze membership (T-204)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string, @CurrentUser('id') u: string) {
    return this.service.approve(id, t, u);
  }

  @Post(':id/reject')
  @RequirePermissions('membership.approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a membership request' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectMembershipRequestDto,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.reject(id, t, u, dto.reason);
  }
}
