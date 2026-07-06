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
//# sourceMappingURL=score.service.spec.js.map