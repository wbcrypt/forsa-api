-- Migration 006: Payment receipt file upload (T-111)
--
-- Closes two gaps surfaced while wiring the student/guarantor portals'
-- receipt-upload flows to the real S3 presigned-upload path already used by
-- documents.service.ts, instead of only transmitting a filename string
-- (see implementation/KNOWN_ISSUES.md K-45/K-46):
--
-- 1. No active `document_types` row existed for code `payment_receipt` —
--    the presigned upload-url call 400s without one
--    (documents.service.ts#generateUploadUrl validates against this table).
-- 2. `payments` had nowhere to record which uploaded `documents` row (if
--    any) is the actual receipt file — only the legacy `receipt_filename`
--    text column existed, which the new flow supplements rather than
--    replaces (receipt_filename is still populated for display/back-compat).

INSERT INTO document_types (code, display_name, category, description, is_required, is_active)
VALUES ('payment_receipt', 'Payment Receipt', 'financial', 'Bank transfer or cash deposit receipt uploaded by a student or guarantor', false, true)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS receipt_document_id UUID REFERENCES documents(id);

CREATE INDEX IF NOT EXISTS idx_payments_receipt_document ON payments(receipt_document_id);

COMMENT ON COLUMN payments.receipt_document_id IS
  'Links to the documents row for the actual uploaded receipt file (T-111) — populated by the presigned S3 upload flow (POST /documents/upload-url + /confirm-upload, or the guarantor-scoped equivalent). receipt_filename remains for display/back-compat but is no longer the only record of the file.';
