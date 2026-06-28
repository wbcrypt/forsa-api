import {
  IsEmail, IsString, IsOptional, IsArray, IsUUID,
  IsBoolean, MinLength, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { UserStatus } from '../../common/enums';

export class CreateUserDto {
  @ApiProperty()
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
  @MinLength(2)
  @MaxLength(255)
  fullName: string;

  @ApiPropertyOptional({ isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsString()
  status?: UserStatus;
}

export class AssignRoleDto {
  @ApiProperty()
  @IsUUID()
  roleId: string;
}

export class RevokeRoleDto {
  @ApiProperty()
  @IsUUID()
  roleId: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason: string;
}
