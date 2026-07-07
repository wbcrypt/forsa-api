import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The only way a guarantor ever gets portal access — the invite token
 * (emailed by staff via addGuarantor) proves this is genuinely the person
 * staff added, not an anonymous visitor guessing a tenant+email pair (see
 * the retired T-102 flow this replaces).
 */
export class AcceptGuarantorInviteDto {
  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;
}

export class DeclineGuarantorInviteDto {
  @ApiProperty({ required: false, description: 'Optional reason shown to FORSA staff' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
