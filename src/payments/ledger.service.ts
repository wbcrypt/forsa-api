import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * T-109/K-14 — single source of truth for writing to the append-only
 * `financial_ledger` table.
 *
 * Before this existed, two independent code paths wrote to this table with
 * different, incompatible shapes:
 *   - payments.service.ts wrote two rows per entry (one 'debit', one
 *     'credit', each with a single `account` column) — matching the real
 *     schema (migrations/001_initial_schema.sql: `entry_type CHECK
 *     (entry_type IN ('debit','credit'))`, `account VARCHAR(100)` — there
 *     is no `debit_account`/`credit_account` column pair in the live
 *     schema).
 *   - konnect.service.ts wrote a single row referencing `debit_account`,
 *     `credit_account` columns that don't exist at all, with
 *     `entry_type = 'payment'`, which violates the CHECK constraint above.
 *     This was not just "structurally different" from the manual path — it
 *     was a live SQL error on every real Konnect payment confirmation
 *     (undefined column / check violation), thrown *after* the payment had
 *     already been marked 'verified' and the installment 'paid', leaving a
 *     verified payment with no ledger entry at all.
 *
 * Both paths now call this one method, so there is exactly one place that
 * knows the real column shape.
 */
@Injectable()
export class LedgerService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async recordEntries(
    tenantId: string,
    applicationId: string | null,
    referenceId: string,
    entry: {
      debitAccount: string;
      creditAccount: string;
      amount: number;
      currency: string;
      description: string;
      referenceType?: string;
    },
  ): Promise<void> {
    const batchId = uuidv4();
    const referenceType = entry.referenceType || 'payment';

    await this.dataSource.query(
      `INSERT INTO financial_ledger
        (tenant_id, application_id, entry_type, account, amount, currency,
         reference_id, reference_type, description, batch_id)
       VALUES ($1,$2,'debit',$3,$4,$5,$6,$7,$8,$9)`,
      [tenantId, applicationId, entry.debitAccount, entry.amount, entry.currency,
       referenceId, referenceType, entry.description, batchId],
    );

    await this.dataSource.query(
      `INSERT INTO financial_ledger
        (tenant_id, application_id, entry_type, account, amount, currency,
         reference_id, reference_type, description, batch_id)
       VALUES ($1,$2,'credit',$3,$4,$5,$6,$7,$8,$9)`,
      [tenantId, applicationId, entry.creditAccount, entry.amount, entry.currency,
       referenceId, referenceType, entry.description, batchId],
    );
  }
}
