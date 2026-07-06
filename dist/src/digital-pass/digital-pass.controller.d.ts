import { DigitalPassService } from './digital-pass.service';
import { RevokePassDto } from './dto/revoke-pass.dto';
export declare class DigitalPassController {
    private readonly service;
    constructor(service: DigitalPassService);
    verify(token: string): Promise<{
        valid: boolean;
        passStatus: any;
        studentName: string;
        forsaId: any;
        membershipStatus: any;
        memberSince: any;
        university: any;
        academicYear: any;
    }>;
    findMyPass(u: string, t: string): Promise<any>;
    findAll(t: string): Promise<any>;
    revoke(id: string, dto: RevokePassDto, t: string, u: string): Promise<{
        id: string;
        status: string;
    }>;
}
