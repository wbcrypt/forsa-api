import {
  IsEmail, IsString, IsUUID, IsOptional, MinLength, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * T-101 — minimum Phase 1 fix for self-registration.
 *
 * Per DECISIONS.md D-001, the eventual (Phase 2) design is a public
 * "Membership Request" with no password, reviewed by staff, which only
 * provisions a real `users` row on approval. That is explicitly out of
 * scope for Phase 1 (D-001 gates T-203/T-204, not this).
 *
 * This DTO backs the minimal, reversible Phase 1 fix instead: a genuinely
 * public endpoint that creates a `students` row AND a `users` row in one
 * transaction, so the existing register -> POST /auth/login flow the
 * student portal already implements actually works end-to-end. Phase 2 is
 * expected to replace this endpoint's shape — keep it small.
 */
export class RegisterStudentDto {
  @ApiProperty({ description: 'Tenant UUID — the student portal must send the same tenantId it uses for POST /auth/login' })
  @IsUUID()
  tenantId: string;

  @ApiProperty({ example: 'student@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @ApiProperty({ minLength: 12, description: 'Must satisfy the same complexity rules as staff accounts (see UsersService.validatePasswordComplexity): upper+lower+digit+special, min 12 chars.' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phonePrimary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2)
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  academicLevel?: string;
}
