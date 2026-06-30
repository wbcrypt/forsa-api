import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser, CurrentTenant } from '../common/decorators'
import { GuarantorsService } from './guarantors.service'

@ApiTags('Guarantors')
@UseGuards(JwtAuthGuard)
@Controller('guarantors')
export class GuarantorsController {
  constructor(private readonly service: GuarantorsService) {}

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
}
