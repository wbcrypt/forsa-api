import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PipelineService } from './pipeline.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions } from '../common/decorators';

@ApiTags('Financing Decision Pipeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly service: PipelineService) {}

  @Post('applications/:applicationId/run')
  @RequirePermissions('pipeline.run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a new pipeline run for an application' })
  startRun(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() body: { reentryFromStage?: number },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.startRun(applicationId, t, u, body.reentryFromStage);
  }

  @Get('runs/:id')
  @RequirePermissions('pipeline.view')
  @ApiOperation({ summary: 'Get pipeline run details and trace' })
  getRun(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.getPipelineRun(id, t);
  }

  @Post('runs/:id/human-decision')
  @RequirePermissions('pipeline.review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit human review decision — continues pipeline from stage 9' })
  submitHumanDecision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      decision: 'approved' | 'rejected' | 'on_hold' | 'needs_more_documents';
      approvedAmount?: number;
      notes?: string;
    },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.submitHumanDecision(id, t, u, body.decision, body.approvedAmount, body.notes);
  }
}
