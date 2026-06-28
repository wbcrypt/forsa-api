import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { PolicyModule } from '../policy/policy.module';
import { ScoreModule } from '../score/score.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PolicyModule, ScoreModule, NotificationsModule],
  controllers: [CollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
