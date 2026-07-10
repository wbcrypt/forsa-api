"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const score_service_1 = require("./score.service");
describe('ScoreService.getScoreForMyUniversityStudent', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new score_service_1.ScoreService({ query }, {});
    });
    it('rejects when the student has no application at the caller\'s university', async () => {
        query.mockResolvedValueOnce([]);
        await expect(service.getScoreForMyUniversityStudent('uni-user-1', 'tenant-1', 'student-1')).rejects.toThrow(common_1.NotFoundException);
    });
    it('returns the score when the student has an application at the caller\'s university', async () => {
        query
            .mockResolvedValueOnce([{ '?column?': 1 }])
            .mockResolvedValueOnce([{ id: 'score-1', aggregate_score: 700 }]);
        const result = await service.getScoreForMyUniversityStudent('uni-user-1', 'tenant-1', 'student-1');
        expect(result).toEqual({ id: 'score-1', aggregate_score: 700 });
    });
});
describe('ScoreService.checkAndUpdateCeiling — tenant scope', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new score_service_1.ScoreService({ query }, {});
    });
    it('scopes the active-fraud-event lookup by both student_id and tenant_id', async () => {
        query.mockResolvedValueOnce([]);
        query.mockResolvedValueOnce(undefined);
        await service.checkAndUpdateCeiling('student-1', 'tenant-a');
        const [sql, params] = query.mock.calls[0];
        expect(sql).toContain('tenant_id = $2');
        expect(params).toEqual(['student-1', 'tenant-a']);
    });
    it('does not lift the ceiling when an active fraud event exists for that tenant', async () => {
        query.mockResolvedValueOnce([{ id: 'event-1' }]);
        await service.checkAndUpdateCeiling('student-1', 'tenant-a');
        expect(query).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=score.service.spec.js.map