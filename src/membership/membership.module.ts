import { Module } from '@nestjs/common';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { DigitalPassModule } from '../digital-pass/digital-pass.module';

@Module({
  imports: [NotificationsModule, DigitalPassModule],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
