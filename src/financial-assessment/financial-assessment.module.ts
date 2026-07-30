import { Module } from '@nestjs/common';
import { PolicyModule } from '../policy/policy.module';
import { FinancialAssessmentController } from './financial-assessment.controller';
import { FinancialAssessmentService } from './financial-assessment.service';
import { FinancialAssessmentPolicyService } from './financial-assessment-policy.service';

@Module({
  imports: [PolicyModule],
  controllers: [FinancialAssessmentController],
  providers: [FinancialAssessmentService, FinancialAssessmentPolicyService],
  exports: [FinancialAssessmentService],
})
export class FinancialAssessmentModule {}
