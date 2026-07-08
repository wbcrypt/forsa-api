import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApplicationsService } from './applications.service';
import { ApplicationStatus } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { UniversitiesService } from '../universities/universities.service';

// T-109 — STATUS_TRANSITIONS is the platform's only real enforcement of the
// application lifecycle (no DB-level state machine, no CHECK constraint on
// current_status besides the enum). A regression here would let any
// permission-holding user drive an application through an illegal
// transition (see T-107 for the related boundary-validation hardening).
describe('ApplicationsService.transitionStatus', () => {
  let service: ApplicationsService;
  let query: jest.Mock;
  let notifications: jest.Mocked<Pick<NotificationsService, 'send'>>;

  const baseApplication = {
    id: 'app-1',
    tenant_id: 'tenant-1',
    student_id: 'student-1',
    current_status: ApplicationStatus.NEW_LEAD,
    first_name: 'Amina',
    last_name: 'Trabelsi',
    email: 'amina@example.com',
    university_name: 'Université de Tunis',
    program_name: 'Génie Informatique',
  };

  beforeEach(() => {
    query = jest.fn();
    notifications = { send: jest.fn().mockResolvedValue(undefined) };
    service = new ApplicationsService(
      { query } as unknown as DataSource,
      notifications as unknown as NotificationsService,
      {} as unknown as UniversitiesService,
    );
  });

  it('allows a legal transition and records status history', async () => {
    query
      .mockResolvedValueOnce([baseApplication]) // findOne (inside transitionStatus)
      .mockResolvedValueOnce(undefined)          // UPDATE applications
      .mockResolvedValueOnce(undefined)          // INSERT application_status_history
      .mockResolvedValueOnce(undefined);         // INSERT audit_logs

    const result = await service.transitionStatus(
      'app-1', 'tenant-1', ApplicationStatus.CONTACTED, 'staff-1', 'Called the student',
    );

    expect(result).toEqual({
      id: 'app-1', previousStatus: ApplicationStatus.NEW_LEAD, newStatus: ApplicationStatus.CONTACTED,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE applications SET current_status'),
      ['app-1', 'tenant-1', ApplicationStatus.CONTACTED],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO application_status_history'),
      ['app-1', ApplicationStatus.NEW_LEAD, ApplicationStatus.CONTACTED, 'staff-1', null, 'Called the student'],
    );
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('rejects an illegal transition without writing anything', async () => {
    query.mockResolvedValueOnce([baseApplication]); // findOne only

    await expect(
      service.transitionStatus('app-1', 'tenant-1', ApplicationStatus.APPROVED_LEVEL1, 'staff-1'),
    ).rejects.toThrow(BadRequestException);

    // Only the findOne SELECT should have run — no UPDATE/INSERT for a
    // rejected transition.
    expect(query).toHaveBeenCalledTimes(1);
  });

  // Business decision (2026-07-06) — self-submitted Financing Requests
  // must enter the automated pipeline without a manual staff CRM step.
  // Before this fix, NEW_LEAD only permitted CONTACTED/
  // WAITING_FOR_DOCUMENTS — every self-submitted application (which
  // always starts at NEW_LEAD) failed its very first "Run Pipeline"
  // click with "Invalid status transition: new_lead -> under_review".
  it('allows a fresh NEW_LEAD application to transition directly to UNDER_REVIEW (pipeline auto-entry)', async () => {
    query
      .mockResolvedValueOnce([baseApplication]) // findOne
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const result = await service.transitionStatus(
      'app-1', 'tenant-1', ApplicationStatus.UNDER_REVIEW, null, 'Entered automated review',
    );

    expect(result).toEqual({
      id: 'app-1', previousStatus: ApplicationStatus.NEW_LEAD, newStatus: ApplicationStatus.UNDER_REVIEW,
    });
  });

  it('rejects a transition into one of the enum\'s dead V2-vocabulary values', async () => {
    query.mockResolvedValueOnce([baseApplication]);

    // 'ai_interview_completed' is a real ApplicationStatus enum member but
    // is not a reachable target from any state in STATUS_TRANSITIONS — this
    // is exactly what ApplicationWorkflowPage (forsa-dashboard) sends today.
    await expect(
      service.transitionStatus('app-1', 'tenant-1', ApplicationStatus.AI_INTERVIEW_COMPLETED, 'staff-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('sends an application_rejected notification when transitioning to rejected', async () => {
    const underReview = { ...baseApplication, current_status: ApplicationStatus.UNDER_REVIEW };
    query
      .mockResolvedValueOnce([underReview])       // findOne
      .mockResolvedValueOnce(undefined)            // UPDATE
      .mockResolvedValueOnce(undefined)            // INSERT history
      .mockResolvedValueOnce(undefined)            // INSERT audit_logs
      .mockResolvedValueOnce([{                    // notifyStudent's student lookup
        first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com',
      }]);

    await service.transitionStatus(
      'app-1', 'tenant-1', ApplicationStatus.REJECTED, 'staff-1', 'Insufficient documentation',
    );

    expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
      templateCode: 'application_rejected',
      recipientEmail: 'amina@example.com',
      variables: expect.objectContaining({ rejectionReason: 'Insufficient documentation' }),
    }));
  });

  it('sends an application_approved notification with the correct level on approval', async () => {
    const underReview = { ...baseApplication, current_status: ApplicationStatus.UNDER_REVIEW };
    query
      .mockResolvedValueOnce([underReview])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com' }]);

    await service.transitionStatus('app-1', 'tenant-1', ApplicationStatus.APPROVED_LEVEL2, 'staff-1');

    expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
      templateCode: 'application_approved',
      variables: expect.objectContaining({ approvedLevel: 2, universityName: 'Université de Tunis' }),
    }));
  });

  // T-225 — financingTier is threaded through from the pipeline (resolved
  // before transitionStatus is called — see pipeline.service.ts's
  // stage10DecisionExecution) so Silver/Gold is actually named in the
  // approval email, not a bare "approved".
  it('includes the financing tier in the approval notification when provided', async () => {
    const underReview = { ...baseApplication, current_status: ApplicationStatus.UNDER_REVIEW };
    query
      .mockResolvedValueOnce([underReview])       // findOne
      .mockResolvedValueOnce(undefined)            // UPDATE current_status
      .mockResolvedValueOnce(undefined)            // INSERT history
      .mockResolvedValueOnce(undefined)            // INSERT audit_logs
      .mockResolvedValueOnce(undefined)            // UPDATE applications.financing_tier
      .mockResolvedValueOnce([{ membership_status: 'bronze' }]) // SELECT student's current tier
      .mockResolvedValueOnce(undefined)            // UPDATE students.membership_status (ratchets up)
      .mockResolvedValueOnce(undefined)            // INSERT membership_status_history
      .mockResolvedValueOnce([{ first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com' }]);

    await service.transitionStatus('app-1', 'tenant-1', ApplicationStatus.APPROVED_LEVEL2, 'staff-1', undefined, undefined, 'gold');

    expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
      templateCode: 'application_approved',
      variables: expect.objectContaining({ tierSuffix: ' (Gold tier)' }),
    }));
  });

  // Phase 8 workflow audit — the gap this closes: approving via the manual
  // admin screen (this same transitionStatus method the pipeline's
  // human-decision path also shares logic with) used to only word the
  // email; the student's real membership_status never moved. Now it must
  // ratchet up to match, exactly like the automated pipeline path already
  // did, and never move down for a lower/equal tier.
  it('ratchets the student membership_status up to match the approved tier', async () => {
    const underReview = { ...baseApplication, current_status: ApplicationStatus.UNDER_REVIEW };
    query
      .mockResolvedValueOnce([underReview])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ membership_status: 'bronze' }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com' }]);

    await service.transitionStatus('app-1', 'tenant-1', ApplicationStatus.APPROVED_LEVEL2, 'staff-1', undefined, undefined, 'silver');

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE students SET membership_status'),
      ['student-1', 'silver'],
    );
  });

  it('never lowers membership_status when the approved tier ranks below the student\'s current one', async () => {
    const underReview = { ...baseApplication, current_status: ApplicationStatus.UNDER_REVIEW };
    query
      .mockResolvedValueOnce([underReview])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ membership_status: 'gold' }])
      .mockResolvedValueOnce([{ first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com' }]);

    await service.transitionStatus('app-1', 'tenant-1', ApplicationStatus.APPROVED_LEVEL1, 'staff-1', undefined, undefined, 'silver');

    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE students SET membership_status'),
      expect.anything(),
    );
  });

  // T-225/D-004 — Waiting List must never read like a rejection.
  it('sends a waiting_list notification (not a rejection) when transitioned to CAPITAL_QUEUE', async () => {
    const underReview = { ...baseApplication, current_status: ApplicationStatus.UNDER_REVIEW };
    query
      .mockResolvedValueOnce([underReview])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com' }]);

    await service.transitionStatus('app-1', 'tenant-1', ApplicationStatus.CAPITAL_QUEUE, 'staff-1');

    expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
      templateCode: 'waiting_list',
      recipientEmail: 'amina@example.com',
    }));
  });

  // Phase 3 (browser E2E testing) discovery — pipeline.service.ts calls
  // transitionStatus with the literal string 'system' for automated,
  // pipeline-driven transitions. application_status_history.changed_by
  // is a UUID column — every automated transition threw "invalid input
  // syntax for type uuid" and the whole pipeline run silently failed.
  // Exact same bug class as the earlier recordedBy:'system'/
  // score_events.recorded_by fix (K-13). Locks down that changedBy=null
  // is accepted and passed straight through, not coerced to a string.
  it('accepts a null changedBy for system/pipeline-driven transitions', async () => {
    const underReview = { ...baseApplication, current_status: ApplicationStatus.UNDER_REVIEW };
    query
      .mockResolvedValueOnce([underReview])
      .mockResolvedValueOnce(undefined) // UPDATE applications
      .mockResolvedValueOnce(undefined) // INSERT application_status_history
      .mockResolvedValueOnce(undefined); // audit

    await service.transitionStatus('app-1', 'tenant-1', ApplicationStatus.ON_HOLD, null, 'Pipeline decision', 'run-1');

    const historyInsertCall = query.mock.calls[2];
    expect(historyInsertCall[0]).toContain('INSERT INTO application_status_history');
    expect(historyInsertCall[1]).toContain(null);
  });
});

// T-207 — the student portal's actual entry point into the Financing
// Request flow. Locks down two things that used to be silently broken:
// (1) a self-registered student (who holds zero role/permission grants
// today) can now reach this without the staff-only application.create
// permission, and (2) it's gated on active Bronze+ membership per D-004 —
// a Visitor/non-member/blacklisted account cannot reach financing.
describe('ApplicationsService.createForSelf', () => {
  let service: ApplicationsService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    service = new ApplicationsService(
      { query } as unknown as DataSource,
      {} as unknown as NotificationsService,
      {} as unknown as UniversitiesService,
    );
  });

  it('throws NotFoundException when no student profile is linked to this user', async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.createForSelf('user-1', 'tenant-1', {})).rejects.toThrow('No student profile linked to this user');
  });

  it('rejects a visitor with no membership status at all', async () => {
    query.mockResolvedValueOnce([{ id: 'student-1', membership_status: null }]);
    await expect(service.createForSelf('user-1', 'tenant-1', {})).rejects.toThrow(
      'Submit a Membership Request and wait for Bronze approval before requesting financing.',
    );
  });

  it('rejects a blacklisted member with a distinct message', async () => {
    query.mockResolvedValueOnce([{ id: 'student-1', membership_status: 'blacklisted' }]);
    await expect(service.createForSelf('user-1', 'tenant-1', {})).rejects.toThrow(
      'This account cannot submit financing requests.',
    );
  });

  const ALL_REQUIRED_DOCS = [
    { document_type_code: 'national_id', id: 'doc-1' },
    { document_type_code: 'bac_diploma', id: 'doc-2' },
    { document_type_code: 'university_acceptance', id: 'doc-3' },
    { document_type_code: 'income_proof', id: 'doc-4' },
  ];
  const COMPLETE_DTO = {
    tuitionAmount: 5000, programId: 'program-1', universityId: 'uni-1', academicYear: '2026-2027',
  };

  it('resolves studentId from the caller identity and never trusts a client-supplied one', async () => {
    query
      .mockResolvedValueOnce([{ id: 'student-1', membership_status: 'bronze' }]) // membership check
      .mockResolvedValueOnce([]) // in-flight duplicate check — none found
      .mockResolvedValueOnce(ALL_REQUIRED_DOCS) // required-document completeness check
      .mockResolvedValueOnce([{ id: 'app-1', student_id: 'student-1' }]) // INSERT applications
      .mockResolvedValueOnce(undefined) // INSERT application_status_history
      .mockResolvedValueOnce(undefined) // audit
      .mockResolvedValueOnce([]) // notifyStudent's student lookup
      .mockResolvedValue(undefined); // the 8 attach-documents UPDATE/INSERT calls that follow

    // A malicious/confused client-supplied studentId in the body must be
    // ignored — the resolved identity always wins.
    await service.createForSelf('user-1', 'tenant-1', { ...COMPLETE_DTO, studentId: 'someone-elses-student-id' });

    const insertCall = query.mock.calls[3];
    expect(insertCall[0]).toContain('INSERT INTO applications');
    expect(insertCall[1]).toContain('student-1');
    expect(insertCall[1]).not.toContain('someone-elses-student-id');
  });

  // Manual pilot testing discovery — the admin pipeline's Stage 1
  // Completeness Gate blocked every self-submitted application because
  // nothing in the student flow ever required these fields/documents
  // before letting a student submit. Locks down that createForSelf now
  // rejects incomplete submissions itself, rather than silently creating
  // an application guaranteed to fail Stage 1.
  it('rejects submission when required fields are missing', async () => {
    query.mockResolvedValueOnce([{ id: 'student-1', membership_status: 'bronze' }])
      .mockResolvedValueOnce([]);

    await expect(service.createForSelf('user-1', 'tenant-1', { tuitionAmount: 5000 }))
      .rejects.toThrow(/program, university, academic year/);
  });

  it('rejects submission when required documents are missing', async () => {
    query.mockResolvedValueOnce([{ id: 'student-1', membership_status: 'bronze' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([ALL_REQUIRED_DOCS[0], ALL_REQUIRED_DOCS[1]]); // only 2 of 4 uploaded

    await expect(service.createForSelf('user-1', 'tenant-1', COMPLETE_DTO))
      .rejects.toThrow(/university_acceptance, income_proof/);
  });

  // Phase 8 workflow audit — no check existed at all before this: a
  // student could submit any number of Tuition Facilitation requests
  // while one was already in flight. Terminal states (rejected/
  // completed/withdrawn) must NOT block — that's exactly the "Apply
  // Again" path a rejected student is meant to use.
  it('blocks a second submission while one is already in flight', async () => {
    query
      .mockResolvedValueOnce([{ id: 'student-1', membership_status: 'bronze' }])
      .mockResolvedValueOnce([{ id: 'existing-app-1' }]); // an in-flight application exists

    await expect(service.createForSelf('user-1', 'tenant-1', { tuitionAmount: 5000 })).rejects.toThrow(
      'You already have a Tuition Facilitation request in progress. Please wait for a decision before submitting another.',
    );
  });

  it('does not block a resubmission when the only prior application is a terminal state', async () => {
    query
      .mockResolvedValueOnce([{ id: 'student-1', membership_status: 'bronze' }])
      .mockResolvedValueOnce([]) // rejected/completed/withdrawn excluded server-side, so none found
      .mockResolvedValueOnce(ALL_REQUIRED_DOCS)
      .mockResolvedValueOnce([{ id: 'app-2', student_id: 'student-1' }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([])
      .mockResolvedValue(undefined);

    await expect(service.createForSelf('user-1', 'tenant-1', COMPLETE_DTO)).resolves.toBeDefined();

    const dupCheckCall = query.mock.calls[1];
    expect(dupCheckCall[0]).toContain("NOT IN ('rejected', 'completed', 'withdrawn')");
  });
});

// T-211/D-003 — ai_score_overall/ai_recommendation must be computed
// server-side from the AI's raw per-dimension scores, never trusted
// directly from whatever the client sends. Locks down that a
// manipulated/fabricated client-supplied aiScoreOverall is silently
// ignored and replaced by the real weighted computation.
describe('ApplicationsService.create — deterministic AI scoring (T-211)', () => {
  let service: ApplicationsService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    service = new ApplicationsService(
      { query } as unknown as DataSource,
      { send: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService,
      {} as unknown as UniversitiesService,
    );
  });

  it('recomputes ai_score_overall from aiReport.scores, ignoring a client-supplied aiScoreOverall', async () => {
    query
      .mockResolvedValueOnce([{ id: 'app-1', student_id: 'student-1' }]) // INSERT applications
      .mockResolvedValueOnce(undefined) // status history
      .mockResolvedValueOnce(undefined) // audit
      .mockResolvedValueOnce([]); // notifyStudent lookup

    await service.create({
      studentId: 'student-1',
      aiScoreOverall: 999, // a manipulated/fabricated client value — must be ignored
      aiReport: {
        scores: {
          householdStability: 80, financialCapacity: 60, academicCommitment: 70,
          documentationQuality: 90, aiInterviewAssessment: 50,
        },
      },
    }, 'tenant-1', 'creator-1');

    const insertCall = query.mock.calls[0];
    // 80*.35 + 60*.25 + 70*.20 + 90*.10 + 50*.10 = 71 (see household-stability.util.spec.ts)
    expect(insertCall[1]).toContain(71);
    expect(insertCall[1]).not.toContain(999);
    // Recommendation must be derived from the real computed score (71 ->
    // Silver Candidate), not any client-supplied label.
    expect(insertCall[1]).toContain('Silver Candidate');
  });

  it('stores null ai_score_overall when the report is marked demo_mode, even with a full scores object', async () => {
    query
      .mockResolvedValueOnce([{ id: 'app-1', student_id: 'student-1' }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([]);

    await service.create({
      studentId: 'student-1',
      aiReport: {
        demo_mode: true,
        scores: {
          householdStability: 80, financialCapacity: 60, academicCommitment: 70,
          documentationQuality: 90, aiInterviewAssessment: 50,
        },
      },
    }, 'tenant-1', 'creator-1');

    const insertCall = query.mock.calls[0];
    expect(insertCall[1][15]).toBeNull(); // ai_score_overall param position
  });

  it('stores null ai_score_overall when aiReport.scores is missing or incomplete', async () => {
    query
      .mockResolvedValueOnce([{ id: 'app-1', student_id: 'student-1' }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([]);

    await service.create({
      studentId: 'student-1',
      aiReport: { scores: { householdStability: 80 } }, // incomplete
    }, 'tenant-1', 'creator-1');

    const insertCall = query.mock.calls[0];
    expect(insertCall[1][15]).toBeNull();
  });
});

// T-223 — the university portal's one write capability. Locks down the
// self-scoping check: a university can only confirm its own students'
// applications, resolved server-side via universitiesService.findMe
// (the JWT identity), never a client-supplied university id (T-223's own
// identity-isolation fix, migration 011).
describe('ApplicationsService.confirmEnrollment', () => {
  let service: ApplicationsService;
  let query: jest.Mock;
  let universitiesService: jest.Mocked<Pick<UniversitiesService, 'findMe'>>;

  beforeEach(() => {
    query = jest.fn();
    universitiesService = { findMe: jest.fn() };
    service = new ApplicationsService(
      { query } as unknown as DataSource,
      { send: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService,
      universitiesService as unknown as UniversitiesService,
    );
  });

  it('rejects confirming an application belonging to a different university', async () => {
    universitiesService.findMe.mockResolvedValueOnce({ id: 'uni-1' });
    query.mockResolvedValueOnce([{ id: 'app-1', university_id: 'uni-2', current_status: 'contract_signed' }]); // findOne

    await expect(
      service.confirmEnrollment('app-1', 'tenant-1', 'uni-user-1'),
    ).rejects.toThrow('This application does not belong to your university');
  });

  it('confirms enrollment for the calling university\'s own application', async () => {
    universitiesService.findMe.mockResolvedValueOnce({ id: 'uni-1' });
    query
      .mockResolvedValueOnce([{ id: 'app-1', university_id: 'uni-1', current_status: 'contract_signed' }]) // findOne (confirmEnrollment)
      .mockResolvedValueOnce([{ id: 'app-1', university_id: 'uni-1', current_status: 'contract_signed' }]) // findOne (inside transitionStatus)
      .mockResolvedValueOnce(undefined) // UPDATE applications
      .mockResolvedValueOnce(undefined) // INSERT application_status_history
      .mockResolvedValueOnce(undefined); // INSERT audit_logs

    await service.confirmEnrollment('app-1', 'tenant-1', 'uni-user-1', 'Enrollment verified');

    const updateCall = query.mock.calls[2];
    expect(updateCall[0]).toContain('UPDATE applications SET current_status');
    expect(updateCall[1]).toContain('university_confirmed');
  });
});

// Workflow alignment fix — requirement 5: "Admin application page should
// show a clear completeness checklist." Mirrors exactly what Stage 1 of
// the pipeline checks, so an admin sees the same signal the gate uses
// rather than having to guess why an application is stuck.
describe('ApplicationsService.findOneForAdmin — completeness checklist', () => {
  let service: ApplicationsService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    service = new ApplicationsService(
      { query } as unknown as DataSource,
      {} as unknown as NotificationsService,
      {} as unknown as UniversitiesService,
    );
  });

  const baseApp = { id: 'app-1', student_id: 'student-1', program_id: 'program-1' };

  it('reports allComplete: true only when program, all 4 verified documents, and a live guarantor all exist', async () => {
    query
      .mockResolvedValueOnce([baseApp]) // findOne
      .mockResolvedValueOnce([
        { document_type_code: 'national_id', status: 'verified' },
        { document_type_code: 'bac_diploma', status: 'verified' },
        { document_type_code: 'university_acceptance', status: 'under_review' },
        { document_type_code: 'income_proof', status: 'verified' },
      ])
      .mockResolvedValueOnce([{ status: 'pending_invitation', first_name: 'Mohamed', last_name: 'Ali', email: 'g@example.com' }]);

    const result = await service.findOneForAdmin('app-1', 'tenant-1');

    expect(result.completeness.programSelected).toBe(true);
    expect(result.completeness.guarantor).toEqual(expect.objectContaining({ status: 'pending_invitation', name: 'Mohamed Ali' }));
    expect(result.completeness.allComplete).toBe(true);
  });

  it('reports each missing document as absent and allComplete: false when documents are missing', async () => {
    query
      .mockResolvedValueOnce([baseApp])
      .mockResolvedValueOnce([{ document_type_code: 'national_id', status: 'verified' }]) // only 1 of 4
      .mockResolvedValueOnce([{ status: 'active', first_name: 'Mohamed', last_name: 'Ali', email: 'g@example.com' }]);

    const result = await service.findOneForAdmin('app-1', 'tenant-1');

    const byType = Object.fromEntries(result.completeness.documents.map((d: any) => [d.type, d.status]));
    expect(byType.national_id).toBe('verified');
    expect(byType.bac_diploma).toBe('absent');
    expect(result.completeness.allComplete).toBe(false);
  });

  it('reports guarantor: null and allComplete: false when no guarantor has ever been added', async () => {
    query
      .mockResolvedValueOnce([baseApp])
      .mockResolvedValueOnce([
        { document_type_code: 'national_id', status: 'verified' },
        { document_type_code: 'bac_diploma', status: 'verified' },
        { document_type_code: 'university_acceptance', status: 'verified' },
        { document_type_code: 'income_proof', status: 'verified' },
      ])
      .mockResolvedValueOnce([]); // no guarantor link

    const result = await service.findOneForAdmin('app-1', 'tenant-1');

    expect(result.completeness.guarantor).toBeNull();
    expect(result.completeness.allComplete).toBe(false);
  });
});

// Phase 3 (browser E2E testing) discovery — StudentDetailPage called the
// staff-only GET /applications/:id and /:id/status-history directly,
// 403ing for every real university account (a separate bug from the
// findAllForMyUniversity/confirmEnrollment fixes above — this is single
// application *detail*, not the list, and not a write).
describe('ApplicationsService.findOneForMyUniversity / getStatusHistoryForMyUniversity', () => {
  let service: ApplicationsService;
  let query: jest.Mock;
  let universitiesService: jest.Mocked<Pick<UniversitiesService, 'findMe'>>;

  beforeEach(() => {
    query = jest.fn();
    universitiesService = { findMe: jest.fn() };
    service = new ApplicationsService(
      { query } as unknown as DataSource,
      {} as unknown as NotificationsService,
      universitiesService as unknown as UniversitiesService,
    );
  });

  it('rejects an application belonging to a different university', async () => {
    universitiesService.findMe.mockResolvedValueOnce({ id: 'uni-1' });
    query.mockResolvedValueOnce([{ id: 'app-1', university_id: 'uni-2' }]); // findOne

    await expect(
      service.findOneForMyUniversity('uni-user-1', 'tenant-1', 'app-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns the application detail for the calling university\'s own application', async () => {
    universitiesService.findMe.mockResolvedValueOnce({ id: 'uni-1' });
    query.mockResolvedValueOnce([{ id: 'app-1', university_id: 'uni-1' }]);

    const result = await service.findOneForMyUniversity('uni-user-1', 'tenant-1', 'app-1');
    expect(result).toEqual({ id: 'app-1', university_id: 'uni-1' });
  });

  it('rejects status history for an application belonging to a different university', async () => {
    universitiesService.findMe.mockResolvedValueOnce({ id: 'uni-1' });
    query.mockResolvedValueOnce([{ id: 'app-1', university_id: 'uni-2' }]);

    await expect(
      service.getStatusHistoryForMyUniversity('uni-user-1', 'tenant-1', 'app-1'),
    ).rejects.toThrow(NotFoundException);
  });
});

// Phase 3 (browser E2E testing) discovery — ApplicationPage called the
// staff-only GET /applications/:id/status-history directly, 403ing for
// every real student.
describe('ApplicationsService.getStatusHistoryForMe', () => {
  let service: ApplicationsService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    service = new ApplicationsService(
      { query } as unknown as DataSource,
      {} as unknown as NotificationsService,
      {} as unknown as UniversitiesService,
    );
  });

  it('rejects when the caller does not own the application', async () => {
    query.mockResolvedValueOnce([]); // ownership check finds nothing

    await expect(
      service.getStatusHistoryForMe('user-1', 'tenant-1', 'app-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns status history for the calling student\'s own application', async () => {
    query
      .mockResolvedValueOnce([{ id: 'app-1' }]) // ownership check
      .mockResolvedValueOnce([{ id: 'app-1' }]) // findOne (inside getStatusHistory)
      .mockResolvedValueOnce([{ id: 'hist-1', new_status: 'contacted' }]); // status history rows

    const result = await service.getStatusHistoryForMe('user-1', 'tenant-1', 'app-1');
    expect(result).toEqual([{ id: 'hist-1', new_status: 'contacted' }]);
  });
});
