import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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

  // Phase 3 (browser E2E testing) discovery — the student portal's
  // payment-receipt upload called the staff-only route above directly,
  // 403ing for every real student. Self-scoped: no entityType/entityId
  // in the request body at all — the service forces both server-side.
  @Post('me/upload-url')
  @ApiOperation({ summary: "Generate a pre-signed S3 upload URL for the logged-in student's own document" })
  generateMyUploadUrl(
    @Body() body: { documentTypeCode: string; fileName: string; contentType: string },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.generateMyUploadUrl(u, t, body);
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

  @Post('me/:id/confirm-upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm the logged-in student's own upload complete" })
  confirmMyUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { fileSize: number; checksum?: string },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.confirmMyUpload(u, id, t, body.fileSize, body.checksum);
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

  // Phase 3 (browser E2E testing) discovery — the university portal's
  // Documents page and StudentDetailPage called the staff-only route
  // above directly, 403ing for every real university account.
  @Get('university-mine/:id/download-url')
  @ApiOperation({ summary: "Generate a download URL for one of the logged-in university portal user's own students' documents" })
  getDownloadUrlForMyUniversity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
    @ClientIp() ip: string,
  ) {
    return this.service.generateDownloadUrlForMyUniversity(id, t, u, ip);
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

  // Phase 3 (browser E2E testing) discovery — the university portal's
  // Documents page and StudentDetailPage called the staff-only route
  // above directly, 403ing for every real university account.
  @Get('university-mine/checklist/applications/:applicationId')
  @ApiOperation({ summary: "Get a document checklist for one of the logged-in university portal user's own applications" })
  getChecklistForMyUniversity(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.getDocumentChecklistForMyUniversity(applicationId, t, u);
  }
}
