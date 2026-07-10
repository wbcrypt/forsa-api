import {
  Controller, Get, Post, Body, Param,
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

  // T-215/T-216 — Admin Dashboard's Waiting List section.
  @Get('capital-queue')
  @RequirePermissions('pipeline.view')
  @ApiOperation({ summary: 'List the active capital queue / Waiting List, ordered by priority' })
  findCapitalQueue(@CurrentTenant() t: string) {
    return this.service.findCapitalQueue(t);
  }

  // T-217 — Admin Dashboard's Fraud Records section. Registered before
  // any :id-shaped routes for clarity, though 'fraud-records' as a
  // literal path segment has no collision risk with 'runs/:id' anyway.
  @Get('fraud-records')
  @RequirePermissions('fraud.flag')
  @ApiOperation({ summary: 'List fraud records (Admin Dashboard Fraud Records)' })
  findAllFraudRecords(@CurrentTenant() t: string) {
    return this.service.findAllFraudRecords(t);
  }

  @Post('runs/:id/human-decision')
  @RequirePermissions('pipeline.review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit human review decision — continues pipeline from stage 9 (T-213: full outcome set)' })
  submitHumanDecision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      decision: 'approved' | 'rejected' | 'on_hold' | 'needs_more_documents' | 'waiting_list';
      approvedAmount?: number;
      notes?: string;
      financingTier?: 'silver' | 'gold';
    },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.submitHumanDecision(id, t, u, body.decision, body.approvedAmount, body.notes, body.financingTier);
  }

  // T-217 — a dedicated action, deliberately not folded into
  // submitHumanDecision's decision union: fraud is an identity-trust
  // action (permanently blocks this student, not just this one financing
  // decision), not a financing-amount decision, and warrants its own,
  // more restrictive permission.
  @Post('runs/:id/fraud')
  @RequirePermissions('fraud.flag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Flag confirmed fraud — permanently blacklists the student (T-217)' })
  flagFraud(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string; evidenceNotes?: string },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.flagFraud(id, t, u, body.reason, body.evidenceNotes);
  }

  // T-214 — CEO-sole-override: bypasses the dual/executive-approver
  // consensus requirement (K-12) entirely, but is itself gated behind a
  // separate, more restrictive permission than pipeline.review, and
  // always writes an explicit, distinctly-labeled audit trail — this is
  // an override of the control, not a way to quietly avoid ever
  // triggering it.
  @Post('runs/:id/override')
  @RequirePermissions('financing.override')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CEO override — finalizes a decision regardless of pending multi-approver consensus (T-214)' })
  overrideDecision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      decision: 'approved' | 'rejected';
      approvedAmount?: number;
      notes: string;
      financingTier?: 'silver' | 'gold';
    },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.overrideDecision(id, t, u, body.decision, body.notes, body.approvedAmount, body.financingTier);
  }
}
