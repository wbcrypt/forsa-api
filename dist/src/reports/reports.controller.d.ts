import { ReportsService } from './reports.service';
export declare class ReportsController {
    private readonly service;
    constructor(service: ReportsService);
    getCeo(t: string): Promise<{
        summary: any;
        leadTrend: any[];
        collectionTrend: any[];
        partnerStats: any;
    }>;
    getFinance(t: string): Promise<{
        ledger: any[];
        receivables: any;
        recentDisbursements: any[];
    }>;
    getSales(t: string): Promise<{
        funnel: any[];
        bySource: any[];
        byUniversity: any[];
        teamPerformance: any[];
    }>;
    getCollections(t: string): Promise<{
        overview: any;
        aging: any[];
        topOverdue: any[];
    }>;
    getPartners(t: string): Promise<any>;
    getAudit(t: string, module?: string, userId?: string, from?: string, to?: string, limit?: number): Promise<any>;
}
