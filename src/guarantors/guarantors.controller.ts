import {
  Controller, Get, Post, Body, Param, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RequirePermissions } from '../auth/decorators/permissions.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator'
import { GuarantorsService } from './guarantors.service'

@ApiTags('Guarantors')
@UseGuards(JwtAuthGuard)
@Controller('guarantors')
export class GuarantorsController {
  constructor(private readonly service: GuarantorsService) {}

  /**
   * GET /guarantors/my-student
   * Returns the linked student's summary for the guarantor dashboard.
   */
  @Get('my-student')
  @RequirePermissions('guarantor.view')
  @ApiOperation({ summary: 'Get linked student summary for guarantor dashboard' })
  getMyStudent(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.getLinkedStudent(userId, tenantId)
  }

  /**
   * GET /guarantors/my-student/payments
   * Returns the payment schedule for the linked student.
   */
  @Get('my-student/payments')
  @RequirePermissions('guarantor.view')
  @ApiOperation({ summary: 'Get payment schedule for linked student' })
  getMyStudentPayments(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.getLinkedStudentPayments(userId, tenantId)
  }

  /**
   * POST /guarantors/my-student/payment-receipt
   * Guarantor submits a payment receipt on behalf of the student.
   * Identical to the student receipt submission but actor is guarantor.
   */
  @Post('my-student/payment-receipt')
  @RequirePermissions('guarantor.pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit payment receipt on behalf of linked student' })
  submitReceipt(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
    @Body() body: {
      installmentId: string
      paymentDate: string
      amount: number
      bankName?: string
      referenceNumber?: string
      receiptFilename?: string
      notes?: string
    },
  ) {
    return this.service.submitReceiptOnBehalf(userId, tenantId, body)
  }

  /**
   * POST /guarantors/my-student/konnect
   * Initiates a Konnect online payment on behalf of the linked student.
   */
  @Post('my-student/konnect')
  @RequirePermissions('guarantor.pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate Konnect payment on behalf of linked student' })
  initiateKonnect(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email: string,
    @CurrentUser('fullName') fullName: string,
    @CurrentTenant() tenantId: string,
    @Body() body: {
      installmentId: string
      paymentReference: string
      amount: number
    },
  ) {
    return this.service.initiateKonnectOnBehalf(userId, email, fullName, tenantId, body)
  }

  /**
   * GET /guarantors/notifications
   * Returns recent notifications for this guarantor.
   */
  @Get('notifications')
  @RequirePermissions('guarantor.view')
  @ApiOperation({ summary: 'Get guarantor notifications' })
  getNotifications(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.getNotifications(userId, tenantId)
  }
}
