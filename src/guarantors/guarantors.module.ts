import { Module } from '@nestjs/common'
import { GuarantorsController } from './guarantors.controller'
import { GuarantorsService } from './guarantors.service'
import { PaymentsModule } from '../payments/payments.module'

@Module({
  imports: [PaymentsModule],
  controllers: [GuarantorsController],
  providers: [GuarantorsService],
  exports: [GuarantorsService],
})
export class GuarantorsModule {}
