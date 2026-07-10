import {
  Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions } from '../common/decorators';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Post()
  @RequirePermissions('contract.generate')
  @ApiOperation({ summary: 'Generate a contract for a financing decision' })
  generate(@Body() body: any, @CurrentTenant() t: string, @CurrentUser('id') u: string) {
    return this.service.generateContract({ ...body, tenantId: t, generatedBy: u });
  }

  @Get('applications/:applicationId')
  @RequirePermissions('contract.view')
  @ApiOperation({ summary: 'Get all contracts for an application' })
  getForApplication(
    @Param('applicationId', ParseUUIDPipe) id: string,
    @CurrentTenant() t: string,
  ) {
    return this.service.getContractsForApplication(id, t);
  }

  @Post(':id/send')
  @RequirePermissions('contract.send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send contract for signature' })
  sendForSignature(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.sendForSignature(id, t, u);
  }

  @Post(':id/sign')
  @RequirePermissions('contract.sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a signature on a contract' })
  recordSignature(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.recordSignature({ contractId: id, tenantId: t, signedBy: u, ...body });
  }

  @Get(':id/download')
  @RequirePermissions('contract.view')
  @ApiOperation({ summary: 'Get contract download URL' })
  getDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.getContractDownloadUrl(id, t, u);
  }
}
