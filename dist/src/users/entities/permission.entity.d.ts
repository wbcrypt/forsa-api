import { AppendOnlyEntity } from '../../common/entities/base.entity';
export declare class Permission extends AppendOnlyEntity {
    code: string;
    description: string | null;
    module: string;
    action: string;
    isHighImpact: boolean;
}
