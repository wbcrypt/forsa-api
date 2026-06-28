import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { KonnectService } from './konnect.service';
import { PolicyModule } from '../policy/policy.module';
import { ScoreModule } from '../score/score.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PolicyModule, ScoreModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, { provide: 'KonnectService', useClass: require('./konnect.service').KonnectService }],
  exports: [PaymentsService],
})
export class PaymentsModule {}
