import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ScoreService } from './score.service';
import { PolicyService } from '../policy/policy.service';

// Phase 3 (browser E2E testing) discovery — the university portal's
// StudentDetailPage called the staff-only GET /scores/students/:id
// directly, 403ing for every real university account. This locks down
// the fix: a university can only see the score of a student it actually
// has an application relationship with.
describe('ScoreService.getScoreForMyUniversityStudent', () => {
  let service: ScoreService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    service = new ScoreService(
      { query } as unknown as DataSource,
      {} as unknown as PolicyService,
    );
  });

  it('rejects when the student has no application at the caller\'s university', async () => {
    query.mockResolvedValueOnce([]); // ownership check finds nothing

    await expect(
      service.getScoreForMyUniversityStudent('uni-user-1', 'tenant-1', 'student-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns the score when the student has an application at the caller\'s university', async () => {
    query
      .mockResolvedValueOnce([{ '?column?': 1 }])            // ownership check
      .mockResolvedValueOnce([{ id: 'score-1', aggregate_score: 700 }]); // getScore

    const result = await service.getScoreForMyUniversityStudent('uni-user-1', 'tenant-1', 'student-1');
    expect(result).toEqual({ id: 'score-1', aggregate_score: 700 });
  });
});

// Security review finding — checkAndUpdateCeiling's active-fraud-event
// check filtered only on student_id, ignoring score_events.tenant_id (a
// NOT NULL column that exists precisely to scope rows without a join).
// student_id is a globally-unique key so this wasn't reachable
// cross-tenant via a real student row, but nothing at the query level
// enforced that — there's no RLS in this schema. Locks down that the
// tenant_id the caller passes in is actually used to scope the query.
describe('ScoreService.checkAndUpdateCeiling — tenant scope', () => {
  let service: ScoreService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    service = new ScoreService(
      { query } as unknown as DataSource,
      {} as unknown as PolicyService,
    );
  });

  it('scopes the active-fraud-event lookup by both student_id and tenant_id', async () => {
    query.mockResolvedValueOnce([]); // no active fraud event -> ceiling lifted
    query.mockResolvedValueOnce(undefined); // UPDATE forsa_scores

    await (service as any).checkAndUpdateCeiling('student-1', 'tenant-a');

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('tenant_id = $2');
    expect(params).toEqual(['student-1', 'tenant-a']);
  });

  it('does not lift the ceiling when an active fraud event exists for that tenant', async () => {
    query.mockResolvedValueOnce([{ id: 'event-1' }]); // active fraud event found

    await (service as any).checkAndUpdateCeiling('student-1', 'tenant-a');

    expect(query).toHaveBeenCalledTimes(1); // no UPDATE forsa_scores call
  });
});
