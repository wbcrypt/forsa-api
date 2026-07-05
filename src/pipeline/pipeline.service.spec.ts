import { DataSource } from 'typeorm';
import { PipelineService } from './pipeline.service';
import { PolicyService } from '../policy/policy.service';
import { ScoreService } from '../score/score.service';
import { ApplicationsService } from '../applications/applications.service';

// T-109 — stages 1-2 are the first automated gates every application must
// clear before any human ever sees it (see FORSA_PLATFORM_SPEC.md §6.2).
// These call the service's private stage methods directly (a common,
// pragmatic pattern for testing gate logic in isolation without standing up
// the full 10-stage orchestration/DB).
describe('PipelineService — stage gates', () => {
  let service: PipelineService;
  let query: jest.Mock;
  let policyService: jest.Mocked<Pick<PolicyService, 'resolve' | 'getBoolean'>>;

  beforeEach(() => {
    query = jest.fn();
    policyService = {
      resolve: jest.fn().mockResolvedValue(null),
      getBoolean: jest.fn().mockResolvedValue(null),
    };
    service = new PipelineService(
      { query } as unknown as DataSource,
      policyService as unknown as PolicyService,
      {} as unknown as ScoreService,
      {} as unknown as ApplicationsService,
    );
  });

  describe('stage1Completeness', () => {
    const baseCtx = {
      tenantId: 'tenant-1',
      universityId: 'uni-1',
      applicationId: 'app-1',
      studentId: 'student-1',
      application: {
        tuition_amount: 5000, university_id: 'uni-1', student_id: 'student-1', program_id: 'prog-1',
      },
    };

    it('blocks when required documents are missing', async () => {
      query
        .mockResolvedValueOnce([{ document_type_code: 'national_id', status: 'verified' }]) // uploaded docs
        ;
      policyService.getBoolean.mockResolvedValue(false); // guarantor not required

      const result = await (service as any).stage1Completeness(baseCtx);

      expect(result.status).toBe('blocked');
      expect(result.outputs.missingDocuments).toEqual(
        expect.arrayContaining(['bac_diploma', 'university_acceptance', 'income_proof']),
      );
    });

    it('blocks when the policy requires a guarantor and none is linked', async () => {
      query
        .mockResolvedValueOnce([
          { document_type_code: 'national_id', status: 'verified' },
          { document_type_code: 'bac_diploma', status: 'verified' },
          { document_type_code: 'university_acceptance', status: 'verified' },
          { document_type_code: 'income_proof', status: 'verified' },
        ])
        .mockResolvedValueOnce([]); // no active student_guarantors row
      policyService.getBoolean.mockResolvedValue(true); // guarantor required

      const result = await (service as any).stage1Completeness(baseCtx);

      expect(result.status).toBe('blocked');
      expect(result.outputs.missingFields).toContain('guarantor');
    });

    it('passes when all required documents are uploaded and no guarantor is required', async () => {
      query.mockResolvedValueOnce([
        { document_type_code: 'national_id', status: 'verified' },
        { document_type_code: 'bac_diploma', status: 'verified' },
        { document_type_code: 'university_acceptance', status: 'verified' },
        { document_type_code: 'income_proof', status: 'verified' },
      ]);
      policyService.getBoolean.mockResolvedValue(false);

      const result = await (service as any).stage1Completeness(baseCtx);

      expect(result.status).toBe('passed');
    });
  });

  describe('stage2Eligibility', () => {
    const baseCtx = { tenantId: 'tenant-1', applicationId: 'app-1', studentId: 'student-1' };

    it('blocks a student younger than the minimum eligibility age', async () => {
      const sixteenYearsAgo = new Date();
      sixteenYearsAgo.setFullYear(sixteenYearsAgo.getFullYear() - 16);
      query
        .mockResolvedValueOnce([{ date_of_birth: sixteenYearsAgo.toISOString(), nationality: 'TN' }]) // student
        .mockResolvedValueOnce([{ aggregate_score: 500, score_band: 'medium_trust' }])                // score
        .mockResolvedValueOnce([])                                                                    // no fraud flag
        .mockResolvedValueOnce([]);                                                                    // no active financing

      const result = await (service as any).stage2Eligibility(baseCtx);

      expect(result.status).toBe('blocked');
      expect(result.outputs.issues.join(' ')).toMatch(/at least 17 years old/);
    });

    it('blocks a student below the minimum FORSA score', async () => {
      const twentyYearsAgo = new Date();
      twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
      query
        .mockResolvedValueOnce([{ date_of_birth: twentyYearsAgo.toISOString(), nationality: 'TN' }])
        .mockResolvedValueOnce([{ aggregate_score: 250, score_band: 'high_risk' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await (service as any).stage2Eligibility(baseCtx);

      expect(result.status).toBe('blocked');
      expect(result.outputs.issues.join(' ')).toMatch(/below minimum/);
    });

    it('passes an adult student with an adequate score, no fraud flag, and no active financing', async () => {
      const twentyYearsAgo = new Date();
      twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
      query
        .mockResolvedValueOnce([{ date_of_birth: twentyYearsAgo.toISOString(), nationality: 'TN' }])
        .mockResolvedValueOnce([{ aggregate_score: 700, score_band: 'very_good_trust' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await (service as any).stage2Eligibility(baseCtx);

      expect(result.status).toBe('passed');
    });
  });
});
