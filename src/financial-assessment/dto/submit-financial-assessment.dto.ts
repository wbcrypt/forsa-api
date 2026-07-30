import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UpdateFinancialAssessmentDto } from './update-financial-assessment.dto';

// Step 7 — Confirmation. Extends the same optional field set so any
// last-minute edits on the confirmation screen are saved in the same
// request as the final submit, then requires the explicit accuracy
// checkbox before the service will lock the record and score it.
export class SubmitFinancialAssessmentDto extends UpdateFinancialAssessmentDto {
  @ApiProperty({ description: 'Must be true — "I confirm that all information provided is accurate."' })
  @IsBoolean()
  confirmed: boolean;
}
