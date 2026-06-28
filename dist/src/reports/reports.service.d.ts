import { DataSource } from 'typeorm';
export declare class ReportsService {
    private readonly dataSource;
    private readonly logger;
    constructor(dataSource: DataSource);
    getCeoDashboard(tenantId: string): Promise<{
        summary: any;
        leadTrend: any[];
        collectionTrend: any[];
        partnerStats: any;
    }>;
    getFinanceDashboard(tenantId: string): Promise<{
        ledger: any[];
        receivables: any;
        recentDisbursements: any[];
    }>;
    getSalesDashboard(tenantId: string): Promise<{
        funnel: any[];
        bySource: any[];
        byUniversity: any[];
        teamPerformance: any[];
    }>;
    getCollectionsDashboard(tenantId: string): Promise<{
        overview: any;
        aging: any[];
        topOverdue: any[];
    }>;
    getPartnerDashboard(tenantId: string): Promise<any>;
    getAuditReport(tenantId: string, filters: {
        module?: string;
        userId?: string;
        from?: string;
        to?: string;
        limit?: number;
    }): Promise<any>;
}
