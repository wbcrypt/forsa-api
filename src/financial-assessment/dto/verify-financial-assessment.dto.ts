import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UpdateFinancialAssessmentDto } from './update-financial-assessment.dto';
import { VERIFICATION_DECISIONS } from '../financial-assessment.constants';

// Interview mode: staff can correct any of the same fields the guarantor
// declared (each changed field is logged to
// financial_assessment_field_corrections), add notes, and optionally
// finalize the verification decision in the same request.
export class VerifyFinancialAssessmentDto extends UpdateFinancialAssessmentDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000)
  interviewNotes?: string;

  @ApiProperty({ required: false, enum: VERIFICATION_DECISIONS })
  @IsOptional() @IsIn(VERIFICATION_DECISIONS)
  decision?: string;
}
