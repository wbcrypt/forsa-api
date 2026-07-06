import {
  Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ScoreService } from './score.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions } from '../common/decorators';
import { ScoreDimension, SourceTrustLevel, ScoreSeverity } from '../common/enums';

@ApiTags('FORSA Score Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('scores')
export class ScoreController {
  constructor(private readonly service: ScoreService) {}

  @Get('students/:studentId')
  @RequirePermissions('score.view')
  @ApiOperation({ summary: 'Get current FORSA score and dimension breakdown' })
  getScore(@Param('studentId', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.getScore(id, t);
  }

  @Get('university-mine/students/:studentId')
  @ApiOperation({ summary: "Get a FORSA score for one of the logged-in university portal user's own students" })
  getScoreForMyUniversityStudent(
    @Param('studentId', ParseUUIDPipe) id: string,
    @CurrentUser('id') u: string,
    @CurrentTenant() t: string,
  ) {
    return this.service.getScoreForMyUniversityStudent(u, t, id);
  }

  @Get('students/:studentId/history')
  @RequirePermissions('score.view')
  @ApiOperation({ summary: 'Get full immutable score event history' })
  getHistory(@Param('studentId', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.getScoreHistory(id, t);
  }

  @Post('students/:studentId/events')
  @RequirePermissions('score.record')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a new score event (immutable)' })
  recordEvent(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() body: {
      dimension: ScoreDimension;
      eventCode: string;
      points: number;
      sourceType: SourceTrustLevel;
      sourceId: string;
      description: string;
      referenceId?: string;
      referenceType?: string;
      severity?: ScoreSeverity;
    },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.recordEvent({ tenantId: t, studentId, recordedBy: u, ...body });
  }

  @Post('students/:studentId/corrective-events')
  @RequirePermissions('score.correct')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create corrective event (appeal). Supersedes original event 1:1.' })
  createCorrectiveEvent(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() body: {
      originalEventId: string;
      dimension: ScoreDimension;
      reason: string;
      compensatingPoints: number;
    },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.createCorrectiveEvent({ tenantId: t, studentId, approvedBy: u, ...body });
  }

  @Post('students/:studentId/reconcile')
  @RequirePermissions('score.reconcile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger manual score reconciliation for a student' })
  reconcile(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.reconcileStudentScore(studentId, u);
  }
}
