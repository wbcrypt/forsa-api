import { IsEmail, IsString, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'user@forsa.tn' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @ApiProperty({ description: 'Tenant UUID' })
  @IsUUID()
  tenantId: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class VerifyMfaDto {
  @IsString()
  mfaToken: string;

  @IsString()
  @MinLength(6)
  @MaxLength(8)
  code: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(12)
  currentPassword: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword: string;
}

export class SetupMfaDto {
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  verificationCode: string;
}
