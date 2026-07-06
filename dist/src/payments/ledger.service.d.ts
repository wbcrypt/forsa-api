import { DataSource } from 'typeorm';
export declare class LedgerService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    recordEntries(tenantId: string, applicationId: string | null, referenceId: string, entry: {
        debitAccount: string;
        creditAccount: string;
        amount: number;
        currency: string;
        description: string;
        referenceType?: string;
    }): Promise<void>;
}
