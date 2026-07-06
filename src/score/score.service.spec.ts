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
