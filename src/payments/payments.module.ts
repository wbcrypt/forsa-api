import { Module } from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { KonnectService } from './konnect.service'
import { ScoreModule } from '../score/score.module'

@Module({
  imports: [ScoreModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, KonnectService],
  exports: [PaymentsService, KonnectService],
})
export class PaymentsModule {}
