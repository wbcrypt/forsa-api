import { IsEmail, IsString, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * T-102 — guarantor self-registration ("activate my portal account").
 *
 * Unlike student self-registration (T-101, which creates a brand new
 * `students` row), a guarantor row is always created first by staff via the
 * Admin Dashboard's student-detail "add guarantor" modal (see
 * `students.service.ts#addGuarantor`), which already captures the
 * guarantor's email. Self-registration here can therefore never create a
 * new `guarantors` row from scratch — it only activates portal access
 * (creates the `users` row and links it) for an email staff already
 * entered. If no matching un-activated guarantor row exists for the given
 * tenant+email, registration fails — this is intentional, not a bug: an
 * anonymous visitor cannot invent a guarantor relationship.
 */
export class RegisterGuarantorDto {
  @ApiProperty({ description: 'Tenant UUID — must match the tenantId used for POST /auth/login' })
  @IsUUID()
  tenantId: string;

  @ApiProperty({ example: 'guarantor@example.com', description: 'Must match the email a staff member already entered when adding this guarantor to a student' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  fullName: string;
}
