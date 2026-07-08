import { IsString, IsOptional, IsDateString, IsInt, Min, IsArray, IsIn, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Phase 13 (Case Management) — "After approval in principle, generate a
 * Meeting. Both student and guarantor receive: Date, Time, Office
 * location, Reference number, Assigned FORSA officer, Estimated duration,
 * Required original documents, Required attendees, Special instructions."
 */
export class ScheduleMeetingDto {
  @ApiProperty()
  @IsDateString()
  scheduledAt: string;

  @ApiProperty()
  @IsString() @MaxLength(500)
  officeLocation: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  assignedOfficerUserId?: string;

  @ApiProperty({ required: false, default: 30 })
  @IsOptional() @IsInt() @Min(5)
  estimatedDurationMinutes?: number;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional() @IsArray()
  requiredDocuments?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional() @IsArray()
  requiredAttendees?: string[];

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(2000)
  specialInstructions?: string;
}

export class UpdateMeetingStatusDto {
  @ApiProperty({ enum: ['scheduled', 'confirmed', 'completed', 'rescheduled', 'cancelled'] })
  @IsIn(['scheduled', 'confirmed', 'completed', 'rescheduled', 'cancelled'])
  status: string;

  @ApiProperty({ required: false, description: 'Required when status=cancelled' })
  @IsOptional() @IsString() @MaxLength(500)
  cancellationReason?: string;

  @ApiProperty({ required: false, description: 'New date/time, used when status=rescheduled (creates a fresh meeting row)' })
  @IsOptional() @IsDateString()
  newScheduledAt?: string;
}
