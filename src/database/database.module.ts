import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        database: config.get('database.name'),
        username: config.get('database.appUser'),
        password: config.get('database.appPassword'),
        ssl: config.get('database.ssl') ? { rejectUnauthorized: true } : false,
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
        synchronize: false, // NEVER true in production — use migrations
        logging: config.get('env') === 'development' ? ['query', 'error'] : ['error'],
        extra: {
          min: config.get('database.poolMin'),
          max: config.get('database.poolMax'),
          // Set tenant context on every new connection
          application_name: 'forsa_os_app',
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
