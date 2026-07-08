import { computeAdminStage, computeStudentMilestone, ADMIN_STAGE_KEYS } from './application-stages.util';

// Workflow architecture redesign — "the admin pipeline should represent
// the internal operational process, the student timeline should represent
// the customer journey, these are two different views of the same
// application and should not expose the same stages." Both views are
// computed from the exact same (current_status, completeness) input here,
// which is what guarantees they can never silently disagree — there is no
// second stored status for either view to drift out of sync with.

const allVerified = { documents: [
  { type: 'national_id', status: 'verified' },
  { type: 'bac_diploma', status: 'verified' },
  { type: 'university_acceptance', status: 'verified' },
  { type: 'income_proof', status: 'verified' },
], guarantor: { status: 'active' } };

const onlyUploaded = { documents: allVerified.documents.map(d => ({ ...d, status: 'uploaded' })), guarantor: { status: 'active' } };
const guarantorPending = { ...allVerified, guarantor: { status: 'pending_invitation' } };
const noGuarantor = { ...allVerified, guarantor: null };

describe('computeAdminStage', () => {
  it('shows Completeness Verification when documents are uploaded but not yet reviewed, even at new_lead', () => {
    const result = computeAdminStage('new_lead', onlyUploaded);
    expect(result.currentKey).toBe('completeness_verification');
  });

  it('shows Guarantor once documents are verified but the guarantor has not yet accepted', () => {
    const result = computeAdminStage('new_lead', guarantorPending);
    expect(result.currentKey).toBe('guarantor');
  });

  it('shows AI Review once documents and guarantor are both settled but staff has not picked it up yet', () => {
    const result = computeAdminStage('new_lead', allVerified);
    expect(result.currentKey).toBe('ai_review');
  });

  it('shows Internal Review for under_review, more_info_required, on_hold, capital_queue, and appealing alike', () => {
    for (const status of ['under_review', 'more_info_required', 'on_hold', 'capital_queue', 'appealing']) {
      expect(computeAdminStage(status, allVerified).currentKey).toBe('internal_review');
    }
  });

  it('flags capital_queue as the waiting list without treating it as an exception', () => {
    const result = computeAdminStage('capital_queue', allVerified);
    expect(result.isWaitingList).toBe(true);
    expect(result.isException).toBe(false);
  });

  it('maps approved_levelN to Pre-Approval', () => {
    expect(computeAdminStage('approved_level2', allVerified).currentKey).toBe('pre_approval');
  });

  it('maps contract_sent/contract_signed to Contract', () => {
    expect(computeAdminStage('contract_sent', allVerified).currentKey).toBe('contract');
    expect(computeAdminStage('contract_signed', allVerified).currentKey).toBe('contract');
  });

  it('marks Approved as done (alongside University Confirmation) once past it, without ever being the "current" stage', () => {
    const result = computeAdminStage('university_paid', allVerified);
    const approved = result.stages.find(s => s.key === 'approved')!;
    const universityConfirmation = result.stages.find(s => s.key === 'university_confirmation')!;
    expect(approved.status).toBe('done');
    expect(universityConfirmation.status).toBe('done');
    expect(result.currentKey).toBe('university_payment');
  });

  it('treats rejected/fraud_flagged/withdrawn as exceptions, not stalled linear stages', () => {
    expect(computeAdminStage('rejected', allVerified)).toEqual(expect.objectContaining({ currentKey: 'rejected', isException: true }));
    expect(computeAdminStage('fraud_flagged', allVerified)).toEqual(expect.objectContaining({ currentKey: 'fraud_flagged', isException: true }));
    expect(computeAdminStage('withdrawn', allVerified)).toEqual(expect.objectContaining({ currentKey: 'withdrawn', isException: true }));
  });

  it('produces all 12 admin stage keys in the exact order requested', () => {
    expect(ADMIN_STAGE_KEYS).toEqual([
      'draft', 'submitted', 'completeness_verification', 'guarantor', 'ai_review',
      'internal_review', 'pre_approval', 'contract', 'university_confirmation',
      'approved', 'university_payment', 'active_student',
    ]);
  });

  it('marks every stage before the current one as done, and every stage after as upcoming', () => {
    const result = computeAdminStage('contract_signed', allVerified);
    const idx = result.stages.findIndex(s => s.key === 'contract');
    expect(result.stages.slice(0, idx).every(s => s.status === 'done')).toBe(true);
    expect(result.stages.slice(idx + 1).filter(s => s.key !== 'approved').every(s => s.status === 'upcoming')).toBe(true);
  });
});

describe('computeStudentMilestone', () => {
  it('shows Guarantor Status as current when no guarantor has been invited at all', () => {
    const result = computeStudentMilestone('new_lead', noGuarantor);
    const current = result.milestones.find(m => m.status === 'current')!;
    expect(current.key).toBe('guarantor_status');
    expect(current.detail).toBe('Not added yet');
  });

  it('shows Documents Verified as current once a guarantor is invited but documents are still just uploaded', () => {
    const result = computeStudentMilestone('new_lead', { ...onlyUploaded, guarantor: { status: 'pending_invitation' } });
    const current = result.milestones.find(m => m.status === 'current')!;
    expect(current.key).toBe('documents_verified');
  });

  it('never shows an internal CRM term like "contacted" or "capital_queue" as a milestone label', () => {
    const result = computeStudentMilestone('capital_queue', allVerified);
    const labels = result.milestones.map(m => m.label);
    expect(labels.every(l => !/contacted|capital_queue|new_lead/i.test(l))).toBe(true);
    expect(result.isWaitingList).toBe(true);
  });

  it('shows Decision as current and reassuring once rejected, never as a dead end', () => {
    const result = computeStudentMilestone('rejected', allVerified);
    const decision = result.milestones.find(m => m.key === 'decision')!;
    expect(decision.status).toBe('current');
    expect(decision.detail).toMatch(/Bronze membership stays fully active/);
    expect(result.isRejected).toBe(true);
  });

  it('shows Active Student as the final, current milestone once active', () => {
    const result = computeStudentMilestone('active_student', allVerified);
    expect(result.milestones[result.milestones.length - 1]).toEqual(
      expect.objectContaining({ key: 'active_student', status: 'current' }),
    );
  });

  it('produces exactly the 8 milestone keys requested, in order', () => {
    const result = computeStudentMilestone('new_lead', allVerified);
    expect(result.milestones.map(m => m.key)).toEqual([
      'application_started', 'application_submitted', 'documents_verified',
      'guarantor_status', 'under_review', 'decision', 'university_confirmation', 'active_student',
    ]);
  });

  // Phase 13 (Case Management) — "Student should always know ... Next
  // Required Action," computed from the same inputs as the milestones.
  it('tells the student to invite a guarantor when none exists yet', () => {
    expect(computeStudentMilestone('new_lead', noGuarantor).nextAction).toMatch(/Invite a guarantor/);
  });

  it('tells the student no action is needed while under internal review', () => {
    expect(computeStudentMilestone('under_review', allVerified).nextAction).toMatch(/No action needed/);
  });

  it('tells the student to attend their scheduled meeting once one exists, at the decision stage', () => {
    const result = computeStudentMilestone('approved_level2', allVerified, { status: 'scheduled', scheduled_at: '2026-08-01' });
    expect(result.nextAction).toMatch(/Attend your meeting/);
  });

  it('reassures rather than dead-ends once rejected', () => {
    expect(computeStudentMilestone('rejected', allVerified).nextAction).toMatch(/Bronze membership stays fully active/);
  });
});
