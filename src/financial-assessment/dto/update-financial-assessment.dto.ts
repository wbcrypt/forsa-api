import {
  IsOptional, IsString, IsNumber, IsBoolean, IsIn, IsDateString, Min, Max, MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  RELATIONSHIPS, GOVERNORATES, EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, ADDITIONAL_INCOME_TYPES,
} from '../financial-assessment.constants';

// All fields optional — the wizard saves one step at a time via
// PATCH /financial-assessment/me, so any given request only carries a
// subset. Every field maps 1:1 to a financial_assessments column.
export class UpdateFinancialAssessmentDto {
  // Step 1 — Identity
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(255)
  fullName?: string;

  @ApiProperty({ required: false, description: 'Tunisian CIN, 8 digits — stored encrypted' })
  @IsOptional() @IsString() @MaxLength(20)
  cinNumber?: string;

  @ApiProperty({ required: false, enum: RELATIONSHIPS }) @IsOptional() @IsIn(RELATIONSHIPS)
  relationship?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(30)
  phoneNumber?: string;

  @ApiProperty({ required: false, enum: GOVERNORATES }) @IsOptional() @IsIn(GOVERNORATES)
  governorate?: string;

  // Step 2 — Employment
  @ApiProperty({ required: false, enum: EMPLOYMENT_STATUSES }) @IsOptional() @IsIn(EMPLOYMENT_STATUSES)
  employmentStatus?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(255)
  employerName?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(255)
  jobTitle?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(60)
  yearsWithEmployer?: number;

  @ApiProperty({ required: false, enum: EMPLOYMENT_TYPES }) @IsOptional() @IsIn(EMPLOYMENT_TYPES)
  employmentType?: string;

  // Step 3 — Income
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0)
  monthlyNetIncome?: number;

  @ApiProperty({ required: false, enum: ADDITIONAL_INCOME_TYPES }) @IsOptional() @IsIn(ADDITIONAL_INCOME_TYPES)
  additionalIncomeType?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0)
  additionalIncomeAmount?: number;

  // Step 4 — Financial commitments
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0)
  monthlyLoanPayments?: number;

  @ApiProperty({ required: false }) @IsOptional() @IsBoolean()
  hasPreviousUnpaidInstallments?: boolean;

  // Step 5 — Banking
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(255)
  bankName?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsBoolean()
  hasReturnedCheque?: boolean;

  @ApiProperty({ required: false }) @IsOptional() @IsBoolean()
  hasSalarySeizure?: boolean;

  @ApiProperty({ required: false }) @IsOptional() @IsBoolean()
  hasFrequentOverdraft?: boolean;

  // Step 6 — Savings
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0)
  approximateSavings?: number;
}
