import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { DocumentsModule } from '../documents/documents.module';
import { PolicyModule } from '../policy/policy.module';

@Module({
  imports: [DocumentsModule, PolicyModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
