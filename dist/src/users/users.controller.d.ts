import { UsersService } from './users.service';
import { PaginationDto } from '../common/utils/pagination.util';
import { CreateUserDto, AssignRoleDto, RevokeRoleDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    create(dto: CreateUserDto, tenantId: string, userId: string): Promise<import("./entities/user.entity").User>;
    findAll(tenantId: string, pagination: PaginationDto): Promise<import("../common/utils/pagination.util").PaginatedResult<import("./entities/user.entity").User>>;
    findOne(id: string, tenantId: string): Promise<import("./entities/user.entity").User>;
    getRolesAndPermissions(id: string, tenantId: string): Promise<{
        roles: any;
        permissions: any;
    }>;
    update(id: string, dto: UpdateUserDto, tenantId: string, userId: string): Promise<import("./entities/user.entity").User>;
    assignRole(id: string, dto: AssignRoleDto, tenantId: string, userId: string): Promise<void>;
    revokeRole(id: string, dto: RevokeRoleDto, tenantId: string, userId: string): Promise<void>;
    deactivate(id: string, body: {
        reason: string;
    }, tenantId: string, userId: string): Promise<void>;
}
