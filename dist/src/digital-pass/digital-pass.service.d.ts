import { DataSource, EntityManager } from 'typeorm';
export declare class DigitalPassService {
    private readonly dataSource;
    private readonly logger;
    constructor(dataSource: DataSource);
    issueForStudentTx(manager: EntityManager, studentId: string, tenantId: string): Promise<{
        verificationToken: string;
    }>;
    verifyByToken(token: string): Promise<{
        valid: boolean;
        passStatus: any;
        studentName: string;
        forsaId: any;
        membershipStatus: any;
        memberSince: any;
        university: any;
        academicYear: any;
    }>;
    findMyPass(userId: string, tenantId: string): Promise<any>;
    findAll(tenantId: string): Promise<any>;
    revoke(id: string, tenantId: string, revokedBy: string, reason: string): Promise<{
        id: string;
        status: string;
    }>;
}
