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
