import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RevokePassDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason: string;
}
