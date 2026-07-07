import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { PolicyModule } from '../policy/policy.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PolicyModule, NotificationsModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
