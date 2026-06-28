import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { GuarantorsService } from './guarantors.service'

function RequirePermissions(...perms: string[]) { return (t: any, k: any, d: any) => d }
function CurrentUser(field?: string) { return (t: any, k: any, i: any) => {} }
function CurrentTenant() { return (t: any, k: any, i: any) => {} }

@ApiTags('Guarantors')
@UseGuards(JwtAuthGuard)
@Controller('guarantors')
export class GuarantorsController {
  constructor(private readonly service: GuarantorsService) {}

  @Get('my-student')
  getMyStudent() { return this.service.getLinkedStudent('', '') }

  @Get('my-student/payments')
  getMyStudentPayments() { return this.service.getLinkedStudentPayments('', '') }

  @Post('my-student/payment-receipt')
  @HttpCode(HttpStatus.OK)
  submitReceipt(@Body() body: any) { return this.service.submitReceiptOnBehalf('', '', body) }

  @Post('my-student/konnect')
  @HttpCode(HttpStatus.OK)
  initiateKonnect(@Body() body: any) { return this.service.initiateKonnectOnBehalf('', '', '', '', body) }

  @Get('notifications')
  getNotifications() { return this.service.getNotifications('', '') }
}
