import { Module } from '@nestjs/common'
import { GuarantorsController } from './guarantors.controller'
import { GuarantorsService } from './guarantors.service'
import { PaymentsModule } from '../payments/payments.module'
import { KonnectService } from '../payments/konnect.service'

@Module({
  imports: [PaymentsModule],
  controllers: [GuarantorsController],
  providers: [GuarantorsService, KonnectService],
  exports: [GuarantorsService],
})
export class GuarantorsModule {}
