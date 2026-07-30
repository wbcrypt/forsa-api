import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser, CurrentTenant, Public } from '../common/decorators'
import { GuarantorsService } from './guarantors.service'
import { AcceptGuarantorInviteDto, DeclineGuarantorInviteDto } from './dto/accept-guarantor-invite.dto'

@ApiTags('Guarantors')
@UseGuards(JwtAuthGuard)
@Controller('guarantors')
export class GuarantorsController {
  constructor(private readonly service: GuarantorsService) {}

  // Guarantors never self-register from an arbitrary tenant+email guess
  // (the retired T-102 flow) — the only way into the portal is a secure,
  // single-use, expiring token emailed when staff adds the guarantor to a
  // student (students.service.ts#addGuarantor). These 3 routes are the
  // entire public surface of that: preview before committing, accept, or
  // decline — @Public() overrides the class-level JwtAuthGuard for each.
  @Public()
  @Get('invite/:token')
  @ApiOperation({ summary: 'Preview a guarantor invite before accepting/declining — who invited you, for which student' })
  previewInvite(@Param('token') token: string) {
    return this.service.previewInvite(token)
  }

  @Public()
  @Post('invite/:token/accept')
  @ApiOperation({ summary: 'Accept a guarantor invite — sets a password and activates portal access' })
  acceptInvite(@Param('token') token: string, @Body() dto: AcceptGuarantorInviteDto) {
    return this.service.acceptInvite(token, dto)
  }

  @Public()
  @Post('invite/:token/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline a guarantor invite — no account is created' })
  declineInvite(@Param('token') token: string, @Body() dto: DeclineGuarantorInviteDto) {
    return this.service.declineInvite(token, dto)
  }

  @Get('my-student')
  getMyStudent(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) { return this.service.getLinkedStudent(userId, tenantId) }

  @Get('my-student/payments')
  getMyStudentPayments(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) { return this.service.getLinkedStudentPayments(userId, tenantId) }

  // T-111 — presigned upload-url step, ahead of confirm-upload and the
  // receipt submission itself. See GuarantorsService#getReceiptUploadUrl
  // for why this doesn't just call POST /documents/upload-url directly.
  @Post('my-student/payment-receipt/upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a presigned S3 upload URL for a payment receipt file (T-111)' })
  getReceiptUploadUrl(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
    @Body() body: { fileName: string; contentType: string },
  ) { return this.service.getReceiptUploadUrl(userId, tenantId, body.fileName, body.contentType) }

  @Post('my-student/payment-receipt/confirm-upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a payment receipt file finished uploading to S3 (T-111)' })
  confirmReceiptUpload(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
    @Body() body: { documentId: string; fileSize: number; checksum?: string },
  ) { return this.service.confirmReceiptUpload(userId, tenantId, body.documentId, body.fileSize, body.checksum) }

  @Post('my-student/payment-receipt')
  @HttpCode(HttpStatus.OK)
  submitReceipt(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
    @Body() body: any,
  ) { return this.service.submitReceiptOnBehalf(userId, tenantId, body) }

  @Post('my-student/konnect')
  @HttpCode(HttpStatus.OK)
  initiateKonnect(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('email') email: string,
    @CurrentUser('fullName') fullName: string,
    @Body() body: any,
  ) { return this.service.initiateKonnectOnBehalf(userId, tenantId, email, fullName, body) }

  @Get('notifications')
  getNotifications(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) { return this.service.getNotifications(userId, tenantId) }

  // Phase 13 (Case Management) — "Guarantor should always know: Invitation
  // Status, Profile Status, Documents Remaining, Meeting Information."
  // profileStatus is now backed by the Financial Assessment module (see
  // FinancialAssessmentController) — the old PATCH my-case/financial-profile
  // route (Financial Responsibility Profile) has been removed; Financial
  // Assessment is the single source of truth for the guarantor's financial
  // disclosure.
  @Get('my-case')
  @ApiOperation({ summary: "The guarantor's own Case status — profile completeness, documents, meeting" })
  getMyCaseStatus(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) { return this.service.getMyCaseStatus(userId, tenantId) }
}
