import { Module } from '@nestjs/common'
import { GuarantorsController } from './guarantors.controller'
import { GuarantorsService } from './guarantors.service'
import { PaymentsModule } from '../payments/payments.module'
import { DocumentsModule } from '../documents/documents.module'

@Module({
  imports: [PaymentsModule, DocumentsModule],
  controllers: [GuarantorsController],
  // K-13 warm-up finding — KonnectService used to be redundantly redeclared
  // as a local provider here on top of already being imported via
  // PaymentsModule (which exports it fully wired). That redundant local
  // declaration would fail to resolve KonnectService's newly-added
  // ScoreService dependency (ScoreModule is only imported inside
  // PaymentsModule, not re-exported, and isn't reachable from this
  // module's own scope) — removed; GuarantorsService already receives the
  // correctly-wired singleton via the PaymentsModule import alone.
  providers: [GuarantorsService],
  exports: [GuarantorsService],
})
export class GuarantorsModule {}
