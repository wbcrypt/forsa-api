import { IsString, IsOptional, IsNumber, IsBoolean, IsInt, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Phase 13 (Case Management) — Step 4 of the Case wizard: the guarantor's
 * Financial Responsibility Profile, completed after accepting the
 * invitation and before the Case can be considered complete. FORSA
 * evaluates Student + Guarantor + Educational Request as one Case, not
 * the student alone — this is the guarantor half of that financial
 * picture.
 */
export class UpdateFinancialProfileDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsNumber() @Min(0)
  employmentDurationYears?: number;

  @ApiProperty({ required: false, description: 'e.g. under_2000 | 2000_5000 | 5000_10000 | over_10000' })
  @IsOptional() @IsString() @MaxLength(50)
  salaryRange?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(100)
  incomeSource?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(50)
  maritalStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsInt() @Min(0)
  numberOfDependents?: number;

  @ApiProperty({ required: false, description: 'e.g. owner | tenant | family_owned' })
  @IsOptional() @IsString() @MaxLength(50)
  homeOwnership?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber() @Min(0)
  monthlyExpenses?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber() @Min(0)
  existingLoansAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(1000)
  otherGuarantees?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  supportingOtherStudents?: boolean;
}
