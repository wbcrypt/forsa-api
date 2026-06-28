import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions, ClientIp } from '../common/decorators';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post('upload-url')
  @RequirePermissions('document.upload')
  @ApiOperation({ summary: 'Generate a pre-signed S3 upload URL' })
  generateUploadUrl(@Body() body: any, @CurrentTenant() t: string, @CurrentUser('id') u: string) {
    return this.service.generateUploadUrl({ ...body, tenantId: t, uploadedBy: u });
  }

  @Post(':id/confirm-upload')
  @RequirePermissions('document.upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm upload complete after client PUT to S3' })
  confirmUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { fileSize: number; checksum?: string },
    @CurrentTenant() t: string,
  ) {
    return this.service.confirmUpload(id, t, body.fileSize, body.checksum);
  }

  @Get(':id/download-url')
  @RequirePermissions('document.view')
  @ApiOperation({ summary: 'Generate a short-lived pre-signed download URL' })
  getDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
    @ClientIp() ip: string,
  ) {
    return this.service.generateDownloadUrl(id, t, u, ip);
  }

  @Patch(':id/review')
  @RequirePermissions('document.review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify or reject a document' })
  reviewDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { action: 'verify' | 'reject'; notes?: string; rejectionReason?: string },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.reviewDocument(id, t, body.action, u, body.notes, body.rejectionReason);
  }

  @Get('entity/:entityType/:entityId')
  @RequirePermissions('document.view')
  @ApiOperation({ summary: 'List documents for a student/application/guarantor' })
  getForEntity(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @CurrentTenant() t: string,
  ) {
    return this.service.getDocumentsForEntity(entityType, entityId, t);
  }

  @Get('checklist/applications/:applicationId')
  @RequirePermissions('document.view')
  @ApiOperation({ summary: 'Get document completeness checklist for an application' })
  getChecklist(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentTenant() t: string,
  ) {
    return this.service.getDocumentChecklist(applicationId, t);
  }
}
