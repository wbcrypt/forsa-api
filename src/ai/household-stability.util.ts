// Phase 2 T-211 — Household Stability primary evaluation dimension.
//
// D-003: hardcoded for V1, but centralized here in one place so a future
// Policy Engine migration is a swap of this one lookup, not a refactor of
// every call site that currently reads a weight.
//
// D-008: this is the AI-advisory, pre-financing-decision assessment. It is
// NOT the same system as the ongoing post-financing FORSA Score engine
// (src/score/score.service.ts's 5 payment/behavior dimensions) — the two
// must never be merged into one number or one computation. This module
// only ever touches applications.ai_report/ai_score_overall, never
// forsa_scores/score_events.
export const HOUSEHOLD_STABILITY_WEIGHTS = {
  householdStability: 0.35,
  financialCapacity: 0.25,
  academicCommitment: 0.20,
  documentationQuality: 0.10,
  aiInterviewAssessment: 0.10,
} as const;

export interface HouseholdStabilityDimensionScores {
  householdStability: number;
  financialCapacity: number;
  academicCommitment: number;
  documentationQuality: number;
  aiInterviewAssessment: number;
}

// Deterministic weighted average, computed server-side — never trust an
// LLM's own self-reported "overall" figure directly (models are unreliable
// at precise arithmetic, and a client could otherwise send any number it
// wants for a figure that feeds a human review screen). Returns null if
// any required dimension is missing/non-numeric, rather than silently
// scoring on incomplete data.
export function computeHouseholdStabilityScore(scores: Partial<HouseholdStabilityDimensionScores> | null | undefined): number | null {
  if (!scores) return null;

  const keys = Object.keys(HOUSEHOLD_STABILITY_WEIGHTS) as (keyof HouseholdStabilityDimensionScores)[];
  const values = keys.map(k => scores[k]);

  if (values.some(v => typeof v !== 'number' || Number.isNaN(v))) return null;

  const weighted = keys.reduce(
    (sum, key, i) => sum + (values[i] as number) * HOUSEHOLD_STABILITY_WEIGHTS[key],
    0,
  );

  return Math.round(weighted * 100) / 100;
}

// Derived from the same server-computed score, rather than trusted
// directly from the client/LLM — keeps the advisory label internally
// consistent with the number a reviewer actually sees next to it (a
// mismatched "score: 30, recommendation: Gold Candidate" would be
// confusing at best). This is still purely advisory (T-210: AI never
// sets an approval outcome) — a human reviewer makes the actual decision
// regardless of this label.
export function deriveRecommendation(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 80) return 'Gold Candidate';
  if (score >= 60) return 'Silver Candidate';
  if (score >= 40) return 'Referral Candidate';
  return 'Manual Review';
}
