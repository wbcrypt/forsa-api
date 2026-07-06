"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const documents_service_1 = require("./documents.service");
describe('DocumentsService.confirmUpload — expiry computation', () => {
    let service;
    let query;
    const uploadingDoc = {
        id: 'doc-1', tenant_id: 'tenant-1', entity_type: 'student',
        entity_id: 'student-1', document_type_code: 'income_proof', status: 'uploading',
    };
    beforeEach(() => {
        query = jest.fn();
        const config = { get: () => undefined };
        service = new documents_service_1.DocumentsService({ query }, config, {}, {});
    });
    it('sets a real expiry when the document type has a validity period', async () => {
        query
            .mockResolvedValueOnce([uploadingDoc])
            .mockResolvedValueOnce([{ validity_months: 3 }])
            .mockResolvedValueOnce(undefined);
        await service.confirmUpload('doc-1', 'tenant-1', 12345);
        const updateCall = query.mock.calls[2];
        expect(updateCall[0]).toContain('UPDATE documents');
        expect(updateCall[0]).toContain("NOW() + INTERVAL '3 months'");
        expect(updateCall[0]).not.toContain('expires_at = NULL');
    });
    it('leaves expires_at NULL when the document type never expires', async () => {
        query
            .mockResolvedValueOnce([uploadingDoc])
            .mockResolvedValueOnce([{ validity_months: null }])
            .mockResolvedValueOnce(undefined);
        await service.confirmUpload('doc-1', 'tenant-1', 12345);
        const updateCall = query.mock.calls[2];
        expect(updateCall[0]).toContain('expires_at = NULL');
    });
});
describe('DocumentsService.generateMyUploadUrl / confirmMyUpload', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        const config = { get: () => undefined };
        service = new documents_service_1.DocumentsService({ query }, config, {}, {});
    });
    it('rejects when the caller has no linked student profile', async () => {
        query.mockResolvedValueOnce([]);
        await expect(service.generateMyUploadUrl('user-1', 'tenant-1', {
            documentTypeCode: 'bank_receipt', fileName: 'r.pdf', contentType: 'application/pdf',
        })).rejects.toThrow(common_1.NotFoundException);
    });
    it('rejects confirming an upload the caller did not create', async () => {
        query.mockResolvedValueOnce([{ uploaded_by: 'someone-else' }]);
        await expect(service.confirmMyUpload('user-1', 'doc-1', 'tenant-1', 1024)).rejects.toThrow(common_1.NotFoundException);
    });
});
describe('DocumentsService university-scoped self-service', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        const config = { get: () => undefined };
        service = new documents_service_1.DocumentsService({ query }, config, {}, {});
    });
    it('rejects a checklist request for an application at a different university', async () => {
        query.mockResolvedValueOnce([]);
        await expect(service.getDocumentChecklistForMyUniversity('app-1', 'tenant-1', 'uni-user-1')).rejects.toThrow(common_1.NotFoundException);
    });
    it('rejects a download-url request for a document not attached to the caller\'s university', async () => {
        query.mockResolvedValueOnce([]);
        await expect(service.generateDownloadUrlForMyUniversity('doc-1', 'tenant-1', 'uni-user-1', '127.0.0.1')).rejects.toThrow(common_1.NotFoundException);
    });
});
//# sourceMappingURL=documents.service.spec.js.map