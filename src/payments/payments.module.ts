import { Module } from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { KonnectService } from './konnect.service'
import { LedgerService } from './ledger.service'
import { ScoreModule } from '../score/score.module'
import { PolicyModule } from '../policy/policy.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [ScoreModule, PolicyModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, KonnectService, LedgerService],
  exports: [PaymentsService, KonnectService, LedgerService],
})
export class PaymentsModule {}
