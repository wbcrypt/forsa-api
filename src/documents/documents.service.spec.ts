import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from './documents.service';
import { PolicyService } from '../policy/policy.service';
import { NotificationsService } from '../notifications/notifications.service';

// T-208/T-209 — "all documents must be current." confirmUpload is the one
// place a document's expiry gets computed, from document_types
// .validity_months — a gap the platform spec described as already
// scaffolded but, confirmed directly against the live schema, was not
// (see migrations/009_financing_request.sql).
describe('DocumentsService.confirmUpload — expiry computation', () => {
  let service: DocumentsService;
  let query: jest.Mock;

  const uploadingDoc = {
    id: 'doc-1', tenant_id: 'tenant-1', entity_type: 'student',
    entity_id: 'student-1', document_type_code: 'income_proof', status: 'uploading',
  };

  beforeEach(() => {
    query = jest.fn();
    const config = { get: () => undefined } as unknown as ConfigService;
    service = new DocumentsService(
      { query } as unknown as DataSource,
      config,
      {} as unknown as PolicyService,
      {} as unknown as NotificationsService,
    );
  });

  it('sets a real expiry when the document type has a validity period', async () => {
    query
      .mockResolvedValueOnce([uploadingDoc]) // fetch uploading doc
      .mockResolvedValueOnce([{ validity_months: 3 }]) // document_types lookup
      .mockResolvedValueOnce(undefined); // UPDATE documents

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

// Phase 3 (browser E2E testing) discovery — the student portal's
// payment-receipt upload called generateUploadUrl directly (staff-only
// document.upload), 403ing for every real student. These lock down the
// self-scoped replacement: entityType/entityId are never taken from the
// client — the service always resolves the caller's own students.id and
// forces entityType='student'.
describe('DocumentsService.generateMyUploadUrl / confirmMyUpload', () => {
  let service: DocumentsService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    const config = { get: () => undefined } as unknown as ConfigService;
    service = new DocumentsService(
      { query } as unknown as DataSource,
      config,
      {} as unknown as PolicyService,
      {} as unknown as NotificationsService,
    );
  });

  it('rejects when the caller has no linked student profile', async () => {
    query.mockResolvedValueOnce([]); // student lookup finds nothing

    await expect(
      service.generateMyUploadUrl('user-1', 'tenant-1', {
        documentTypeCode: 'bank_receipt', fileName: 'r.pdf', contentType: 'application/pdf',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects confirming an upload the caller did not create', async () => {
    query.mockResolvedValueOnce([{ uploaded_by: 'someone-else' }]);

    await expect(
      service.confirmMyUpload('user-1', 'doc-1', 'tenant-1', 1024),
    ).rejects.toThrow(NotFoundException);
  });
});

// Phase 3 (browser E2E testing) discovery — the university portal's
// Documents page and StudentDetailPage called getDocumentChecklist and
// generateDownloadUrl directly (both staff-only document.view), 403ing
// for every real university account.
describe('DocumentsService university-scoped self-service', () => {
  let service: DocumentsService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    const config = { get: () => undefined } as unknown as ConfigService;
    service = new DocumentsService(
      { query } as unknown as DataSource,
      config,
      {} as unknown as PolicyService,
      {} as unknown as NotificationsService,
    );
  });

  it('rejects a checklist request for an application at a different university', async () => {
    query.mockResolvedValueOnce([]); // ownership check finds nothing

    await expect(
      service.getDocumentChecklistForMyUniversity('app-1', 'tenant-1', 'uni-user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a download-url request for a document not attached to the caller\'s university', async () => {
    query.mockResolvedValueOnce([]); // ownership check finds nothing

    await expect(
      service.generateDownloadUrlForMyUniversity('doc-1', 'tenant-1', 'uni-user-1', '127.0.0.1'),
    ).rejects.toThrow(NotFoundException);
  });
});
