import {
  IsEmail, IsString, IsUUID, IsOptional, IsIn, MinLength, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Phase 2 T-203 — genuinely public Membership Request intake. Per the
 * platform spec and D-004: deliberately minimal, no guarantor, no
 * financial documents at this stage — that's Financing Request scope
 * (M3), reachable only after Bronze membership already exists.
 */
export class CreateMembershipRequestDto {
  @ApiProperty({ description: 'Tenant UUID — same pattern as login' })
  @IsUUID()
  tenantId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  phone: string;

  @ApiProperty({ example: 'student@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional({ description: 'University UUID, if the applicant selected one from the known list' })
  @IsOptional()
  @IsUUID()
  universityId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  programme: string;

  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @MaxLength(20)
  academicYear: string;

  @ApiProperty({ enum: ['current', 'future'] })
  @IsIn(['current', 'future'])
  currentOrFutureStudent: 'current' | 'future';
}
