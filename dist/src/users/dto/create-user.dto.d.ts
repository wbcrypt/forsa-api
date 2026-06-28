import { UserStatus } from '../../common/enums';
export declare class CreateUserDto {
    email: string;
    password: string;
    fullName: string;
    roleIds?: string[];
    mustChangePassword?: boolean;
}
export declare class UpdateUserDto {
    fullName?: string;
    status?: UserStatus;
}
export declare class AssignRoleDto {
    roleId: string;
}
export declare class RevokeRoleDto {
    roleId: string;
    reason: string;
}
