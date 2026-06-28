import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions } from '../common/decorators';
import { PaginationDto } from '../common/utils/pagination.util';
import { CreateUserDto, AssignRoleDto, RevokeRoleDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('user.create')
  @ApiOperation({ summary: 'Create a new user' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.create(dto, tenantId, userId);
  }

  @Get()
  @RequirePermissions('user.view')
  @ApiOperation({ summary: 'List all users' })
  findAll(@CurrentTenant() tenantId: string, @Query() pagination: PaginationDto) {
    return this.usersService.findAll(tenantId, pagination);
  }

  @Get(':id')
  @RequirePermissions('user.view')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.usersService.findOne(id, tenantId);
  }

  @Get(':id/roles')
  @RequirePermissions('user.view')
  @ApiOperation({ summary: 'Get user roles and permissions' })
  getRolesAndPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.usersService.getUserRolesAndPermissions(id, tenantId);
  }

  @Patch(':id')
  @RequirePermissions('user.edit')
  @ApiOperation({ summary: 'Update user' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.update(id, tenantId, dto, userId);
  }

  @Post(':id/roles')
  @RequirePermissions('user.role.assign')
  @ApiOperation({ summary: 'Assign role to user' })
  @HttpCode(HttpStatus.OK)
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.assignRole(id, dto.roleId, tenantId, userId);
  }

  @Delete(':id/roles')
  @RequirePermissions('user.role.assign')
  @ApiOperation({ summary: 'Revoke role from user' })
  @HttpCode(HttpStatus.OK)
  revokeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeRoleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.revokeRole(id, dto.roleId, tenantId, userId, dto.reason);
  }

  @Delete(':id')
  @RequirePermissions('user.deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate user account' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.deactivate(id, tenantId, userId, body.reason);
  }
}
