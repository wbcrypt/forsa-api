import { ApplicationStatus } from '../../common/enums';
export declare class TransitionStatusDto {
    status: ApplicationStatus;
    notes?: string;
    financingTier?: 'silver' | 'gold';
}
