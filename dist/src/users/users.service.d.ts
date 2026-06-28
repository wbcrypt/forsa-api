import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { PaginationDto } from '../common/utils/pagination.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private readonly userRepository;
    private readonly dataSource;
    private readonly configService;
    private readonly logger;
    constructor(userRepository: Repository<User>, dataSource: DataSource, configService: ConfigService);
    create(dto: CreateUserDto, tenantId: string, createdBy: string): Promise<User>;
    findAll(tenantId: string, pagination: PaginationDto): Promise<import("../common/utils/pagination.util").PaginatedResult<User>>;
    findOne(id: string, tenantId: string): Promise<User>;
    findByEmail(email: string, tenantId: string): Promise<User | null>;
    update(id: string, tenantId: string, dto: UpdateUserDto, updatedBy: string): Promise<User>;
    deactivate(id: string, tenantId: string, deactivatedBy: string, reason: string): Promise<void>;
    changePassword(userId: string, tenantId: string, currentPassword: string, newPassword: string): Promise<void>;
    getUserRolesAndPermissions(userId: string, tenantId: string): Promise<{
        roles: any;
        permissions: any;
    }>;
    assignRole(userId: string, roleId: string, tenantId: string, assignedBy: string): Promise<void>;
    revokeRole(userId: string, roleId: string, tenantId: string, revokedBy: string, reason: string): Promise<void>;
    private hashPassword;
    private validatePasswordComplexity;
    private writeAuditLog;
}
