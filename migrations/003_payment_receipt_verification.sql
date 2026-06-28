-- Migration 002: Payment Receipt Verification
-- Adds receipt upload tracking and manual verification workflow to payments table
-- V1: Manual verification only (admin checks bank, then verifies/rejects in system)

-- Add receipt and verification fields to payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS receipt_filename    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS receipt_storage_key VARCHAR(500),
  ADD COLUMN IF NOT EXISTS receipt_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_uploaded_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS bank_name           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by         UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verification_notes  TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason    TEXT,
  ADD COLUMN IF NOT EXISTS student_amount      NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS student_bank_ref    VARCHAR(255);

-- Update default status to 'pending_verification' for new student-submitted receipts
-- Existing admin-recorded payments remain 'confirmed'
-- Status flow: pending_verification → receipt_uploaded → verified | rejected

-- Index for admin payment verify page queries
CREATE INDEX IF NOT EXISTS idx_payments_status_tenant
  ON payments(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_installment_status
  ON payments(installment_id, status);

COMMENT ON COLUMN payments.status IS
  'pending_verification: awaiting student receipt upload
   receipt_uploaded: student uploaded receipt, awaiting admin verification
   verified: admin confirmed payment in bank account
   rejected: admin rejected receipt (wrong amount, wrong ref, etc.)
   confirmed: legacy / admin-recorded payment
   reversed: payment was reversed';

COMMENT ON TABLE payments IS
  'V1 manual verification flow:
   1. Student pays via bank transfer or cash deposit
   2. Student uploads receipt in portal → status = receipt_uploaded
   3. Admin checks real bank account manually
   4. Admin verifies (PATCH /payments/:id/verify status=verified) or rejects
   5. On verify: installment status updates to paid
   6. On reject: student is notified to re-upload correct receipt';
