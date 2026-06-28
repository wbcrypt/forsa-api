import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RolesService } from './roles.service';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UserSession } from './entities/user-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission, UserSession])],
  controllers: [UsersController],
  providers: [UsersService, RolesService],
  exports: [UsersService, RolesService, TypeOrmModule],
})
export class UsersModule {}
