import { ContractsService } from './contracts.service';
export declare class ContractsController {
    private readonly service;
    constructor(service: ContractsService);
    generate(body: any, t: string, u: string): Promise<any>;
    getForApplication(id: string, t: string): Promise<any>;
    sendForSignature(id: string, t: string, u: string): Promise<{
        contractId: string;
        status: import("../common/enums").ContractStatus;
    }>;
    recordSignature(id: string, body: any, t: string, u: string): Promise<{
        contractId: string;
        status: import("../common/enums").ContractStatus;
    }>;
    getDownloadUrl(id: string, t: string, u: string): Promise<{
        downloadUrl: string;
        expiresIn: number;
    }>;
}
