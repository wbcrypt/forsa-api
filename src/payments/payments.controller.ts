import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
  ParseUUIDPipe, HttpCode, HttpStatus, Headers, RawBodyRequest, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { KonnectService } from './konnect.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions, Public } from '../common/decorators';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly service: PaymentsService,
    private readonly konnect: KonnectService,
  ) {}

  @Post('schedules')
  @RequirePermissions('payment.create')
  @ApiOperation({ summary: 'Generate payment schedule from contract and agreement' })
  generateSchedule(@Body() body: any, @CurrentTenant() t: string, @CurrentUser('id') u: string) {
    return this.service.generateSchedule({ ...body, tenantId: t, generatedBy: u });
  }

  @Get('schedules/applications/:applicationId')
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'Get payment schedule for an application' })
  getScheduleForApplication(
    @Param('applicationId', ParseUUIDPipe) id: string,
    @CurrentTenant() t: string,
  ) {
    return this.service.getScheduleForApplication(id, t);
  }

  // Phase 3 (browser E2E testing) discovery — forsa-student called the
  // staff-only route above directly with its own applicationId, 403ing
  // for every real student. Self-scoped: verifies the caller actually
  // owns the application server-side, never trusting the id alone.
  @Get('schedules/me/applications/:applicationId')
  @ApiOperation({ summary: "Get the logged-in student's own payment schedule for one of their applications" })
  getMyScheduleForApplication(
    @Param('applicationId', ParseUUIDPipe) id: string,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.findMyScheduleForApplication(u, id, t);
  }

  // Phase 3 (browser E2E testing) discovery — the university portal's
  // Payments page and StudentDetailPage called the staff-only route
  // below directly, 403ing for every real university account.
  @Get('schedules/university-mine/applications/:applicationId')
  @ApiOperation({ summary: "Get a payment schedule for one of the logged-in university portal user's own applications" })
  getScheduleForMyUniversityApplication(
    @Param('applicationId', ParseUUIDPipe) id: string,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.findScheduleForMyUniversityApplication(u, id, t);
  }

  @Get('schedules/:id')
  @RequirePermissions('payment.view')
  getSchedule(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.getSchedule(id, t);
  }

  @Post('record')
  @RequirePermissions('payment.record')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a payment against an installment' })
  recordPayment(@Body() body: any, @CurrentTenant() t: string, @CurrentUser('id') u: string) {
    return this.service.recordPayment({ ...body, tenantId: t, receivedBy: u });
  }

  @Get('installments/:id/payments')
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'Get all payments for an installment' })
  getInstallmentPayments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() t: string,
  ) {
    return this.service.getInstallmentPayments(id, t);
  }

  @Post(':id/reverse')
  @RequirePermissions('payment.reverse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reverse a confirmed payment (admin)' })
  reversePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.reversePayment(id, t, body.reason, u);
  }

  // ─── Receipt Verification Routes (V1 Manual Flow) ──────────────────────────

  // Phase 3 (browser E2E testing) discovery — gated behind the
  // staff-only payment.record permission despite being the actual
  // student-facing "submit my bank receipt" mechanism (per its own
  // @ApiOperation summary below): 403'd for every real student. No
  // @RequirePermissions() here now — self-scoped instead, with
  // ownership verified server-side in the service (see the K-note
  // there on the studentId param this replaces, which was never even
  // populated in the JWT).
  @Post('receipts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Student submits payment receipt for admin verification' })
  submitReceipt(
    @Body() body: {
      installmentId: string;
      paymentDate: string;
      amount: number;
      bankName?: string;
      referenceNumber?: string;
      receiptFilename?: string;
      receiptDocumentId?: string;
      notes?: string;
    },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.submitReceipt({
      ...body,
      tenantId: t,
      callerUserId: u,
    });
  }

  @Get('receipts')
  @RequirePermissions('payment.view')
  @ApiOperation({ summary: 'List payment receipts for admin verification' })
  listReceipts(
    @Query('status') status: string,
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @CurrentTenant() t: string,
  ) {
    return this.service.listReceipts({
      tenantId: t,
      status,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Patch(':id/verify')
  @RequirePermissions('payment.record')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin verifies payment receipt after checking bank account' })
  verifyPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: 'verified' | 'rejected'; notes?: string; reason?: string },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    if (body.status === 'rejected') {
      return this.service.rejectPayment(id, t, u, body.reason || body.notes || '');
    }
    return this.service.verifyPayment(id, t, u, body.notes);
  }


  // ─── Konnect Online Payment Routes ────────────────────────────────────────

  // Phase 3 (browser E2E testing) discovery — same class of bug as
  // submitReceipt above: gated behind the staff-only payment.record
  // permission despite being the actual "pay by Konnect" button every
  // real student needs — 403'd unconditionally. Self-scoped instead,
  // with ownership verified server-side in KonnectService.
  @Post('konnect/initiate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate a Konnect online payment for an installment' })
  async initiateKonnect(
    @Body() body: {
      installmentId: string;
      paymentReference: string;
      amount: number;
    },
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
    @CurrentUser('email') email: string,
    @CurrentUser('fullName') name: string,
  ) {
    const studentId = await this.service.verifyMyInstallmentOwnership(u, body.installmentId, t);
    return this.konnect.initiatePayment({
      tenantId: t,
      installmentId: body.installmentId,
      studentId,
      studentEmail: email,
      studentName: name || email,
      amount: body.amount,
      paymentReference: body.paymentReference,
    });
  }

  @Public()
  @SkipThrottle()
  @Post('konnect-webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Konnect payment webhook — called by Konnect on payment completion' })
  // Route-level @Public() bypasses JwtAuthGuard (server-to-server callback, no
  // user JWT). The real trust boundary is KonnectService.processWebhook()'s
  // HMAC-SHA256 signature check + anti-replay re-verification against
  // Konnect's own API — do not remove those. See T-105 / K-05.
  // @SkipThrottle() — since T-110 registered ThrottlerGuard globally, this
  // route must opt out: Konnect calls from a small set of shared gateway
  // IPs on behalf of every tenant's students, so per-IP throttling would
  // drop legitimate payment confirmations under normal load.
  konnectWebhook(@Body() payload: any, @Headers('x-konnect-signature') sig: string) {
    return this.konnect.processWebhook(payload, sig);
  }

}
