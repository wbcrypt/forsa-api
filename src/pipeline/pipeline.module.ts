import { Module } from '@nestjs/common';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { PolicyModule } from '../policy/policy.module';
import { ApplicationsModule } from '../applications/applications.module';
import { ScoreModule } from '../score/score.module';

@Module({
  imports: [PolicyModule, ApplicationsModule, ScoreModule],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
