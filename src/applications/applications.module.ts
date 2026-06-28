import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { PolicyModule } from '../policy/policy.module';
import { UniversitiesModule } from '../universities/universities.module';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [PolicyModule, UniversitiesModule, StudentsModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
