import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '../../common/enums';

/**
 * T-107 — boundary-level validation for PATCH /applications/:id/status.
 *
 * Before this DTO, the route accepted a plain untyped `{ status:
 * ApplicationStatus; notes?: string }` body — a TypeScript type annotation
 * only, erased at runtime, giving zero actual validation at the API
 * boundary. The only real protection was ApplicationsService.transitionStatus's
 * internal STATUS_TRANSITIONS allow-list check, which (verified 2026-07-05)
 * already correctly rejects any status value not reachable from the
 * application's current status — including the enum's "dead" V2-vocabulary
 * values (`applied`, `ai_interview_completed`, `internal_review`,
 * `pre_approved`, `document_verification`, `contracts_signed`,
 * `university_payment`) that the Admin Dashboard's ApplicationWorkflowPage
 * writes — with a clear 400 BadRequestException. That backstop remains and
 * is not being weakened. This DTO adds a proper boundary check ahead of it,
 * consistent with how auth/policy DTOs already validate their bodies,
 * instead of relying solely on the service-layer check.
 *
 * Full unification of the two status vocabularies (core pipeline vs. V2
 * dashboard workflow, and eventually Phase 2's membership lifecycle) is
 * out of scope here — see implementation/DECISIONS.md D-004.
 */
export class TransitionStatusDto {
  @ApiProperty({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // Students never manually request Silver/Gold — the membership level is
  // the *result* of an approved Tuition Facilitation Plan, decided here by
  // whoever approves it. Without this, the ApplicationWorkflowPage.tsx
  // "advance status" UI could move an application all the way to approved
  // without ever ratcheting the student's actual membership_status, unlike
  // the pipeline/human-decision path (pipeline.service.ts) which always did.
  @ApiPropertyOptional({ enum: ['silver', 'gold'] })
  @IsOptional()
  @IsEnum(['silver', 'gold'])
  financingTier?: 'silver' | 'gold';
}
