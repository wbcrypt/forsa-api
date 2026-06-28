import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsDateString, IsNumber, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PolicyService } from './policy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions } from '../common/decorators';
import { PolicyScopeType } from '../common/enums';

class CreatePolicyVersionDto {
  @ApiProperty()
  @IsString()
  policyKey: string;

  @ApiProperty({ enum: PolicyScopeType })
  @IsEnum(PolicyScopeType)
  scopeType: PolicyScopeType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  scopeId?: string;

  @ApiProperty()
  value: unknown;

  @ApiProperty()
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiProperty()
  @IsString()
  changeReason: string;
}

@ApiTags('Policy Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('policy')
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Get('definitions')
  @RequirePermissions('policy.view')
  @ApiOperation({ summary: 'List all policy definitions' })
  listDefinitions(@CurrentTenant() tenantId: string) {
    return this.policyService.listDefinitions(tenantId);
  }

  @Get('definitions/:key/history')
  @RequirePermissions('policy.view')
  @ApiOperation({ summary: 'Get version history for a policy (never deleted)' })
  getHistory(
    @Param('key') key: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.policyService.getVersionHistory(key, tenantId);
  }

  @Get('resolve/:key')
  @RequirePermissions('policy.view')
  @ApiOperation({ summary: 'Resolve effective policy value for a context' })
  resolve(
    @Param('key') key: string,
    @CurrentTenant() tenantId: string,
    @Query('universityId') universityId?: string,
    @Query('studentId') studentId?: string,
    @Query('partnerId') partnerId?: string,
  ) {
    return this.policyService.resolve(key, {
      tenantId,
      universityId,
      studentId,
      partnerId,
    });
  }

  @Post('versions')
  @RequirePermissions('policy.create')
  @ApiOperation({ summary: 'Create a new policy version (starts as draft)' })
  createVersion(
    @Body() dto: CreatePolicyVersionDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.policyService.createVersion({
      tenantId,
      policyKey: dto.policyKey,
      scopeType: dto.scopeType,
      scopeId: dto.scopeId,
      value: dto.value,
      effectiveDate: new Date(dto.effectiveDate),
      expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : undefined,
      priority: dto.priority,
      changeReason: dto.changeReason,
      createdBy: userId,
    });
  }

  @Post('versions/:id/approve')
  @RequirePermissions('policy.approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve and activate a draft policy version' })
  approveVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.policyService.approveVersion(id, tenantId, userId);
  }
}
