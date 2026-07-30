import { Controller, Get, Patch, Post, Body, Param, UseGuards, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions } from '../common/decorators';
import { FinancialAssessmentService } from './financial-assessment.service';
import { UpdateFinancialAssessmentDto } from './dto/update-financial-assessment.dto';
import { SubmitFinancialAssessmentDto } from './dto/submit-financial-assessment.dto';
import { VerifyFinancialAssessmentDto } from './dto/verify-financial-assessment.dto';

@ApiTags('Financial Assessment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('financial-assessment')
export class FinancialAssessmentController {
  constructor(private readonly service: FinancialAssessmentService) {}

  @Get('options')
  @ApiOperation({ summary: 'Closed vocabularies for the wizard dropdowns (relationship, governorate, employment status/type, additional income type)' })
  getOptions() {
    return this.service.getOptions();
  }

  // ── Guarantor self-service (no permission required — self-scoped to the
  // caller's own linked application, same convention as GuarantorsController) ──

  @Get('me')
  @ApiOperation({ summary: "The logged-in guarantor's own Financial Assessment (draft or submitted)" })
  getMine(@CurrentUser('id') userId: string, @CurrentTenant() tenantId: string) {
    return this.service.getMine(userId, tenantId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Save one step of the questionnaire (draft — partial fields allowed)' })
  saveDraft(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateFinancialAssessmentDto,
  ) {
    return this.service.saveDraft(userId, tenantId, dto);
  }

  @Post('me/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 7 — final submit: requires the accuracy confirmation, locks the record, and computes the Financial Score' })
  submit(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: SubmitFinancialAssessmentDto,
  ) {
    return this.service.submit(userId, tenantId, dto);
  }

  // ── Interview mode (staff) ──

  @Get('applications/:applicationId')
  @RequirePermissions('financial_assessment.view')
  @ApiOperation({ summary: "Staff view of an application's Financial Assessment, with the full field correction history" })
  getForInterview(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.getForInterview(tenantId, applicationId);
  }

  @Patch('applications/:applicationId/verify')
  @RequirePermissions('financial_assessment.verify')
  @ApiOperation({ summary: 'Interview mode: correct fields against physical documents, add notes, and/or finalize verification — recalculates the score instantly' })
  verify(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') staffUserId: string,
    @Body() dto: VerifyFinancialAssessmentDto,
  ) {
    return this.service.verify(tenantId, staffUserId, applicationId, dto);
  }
}
