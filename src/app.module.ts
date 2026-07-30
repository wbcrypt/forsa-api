import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { configuration, configValidationSchema } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PolicyModule } from './policy/policy.module';
import { UniversitiesModule } from './universities/universities.module';
import { PartnersModule } from './partners/partners.module';
import { StudentsModule } from './students/students.module';
import { MembershipModule } from './membership/membership.module';
import { DigitalPassModule } from './digital-pass/digital-pass.module';
import { ApplicationsModule } from './applications/applications.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { ScoreModule } from './score/score.module';
import { DocumentsModule } from './documents/documents.module';
import { ContractsModule } from './contracts/contracts.module';
import { GuarantorsModule } from './guarantors/guarantors.module';
import { PaymentsModule } from './payments/payments.module';
import { CollectionsModule } from './collections/collections.module';
import { ExecutionModule } from './execution/execution.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { AiModule } from './ai/ai.module';
import { FinancialAssessmentModule } from './financial-assessment/financial-assessment.module';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: configValidationSchema,
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    PolicyModule,
    UniversitiesModule,
    PartnersModule,
    StudentsModule,
    MembershipModule,
    DigitalPassModule,
    ApplicationsModule,
    PipelineModule,
    ScoreModule,
    DocumentsModule,
    ContractsModule,
    PaymentsModule,
    GuarantorsModule,
    CollectionsModule,
    ExecutionModule,
    NotificationsModule,
    ReportsModule,
    AiModule,
    FinancialAssessmentModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
    // T-110: ThrottlerModule was configured (default 100 req/60s, plus
    // stricter @Throttle overrides on login/mfa-verify) but the guard was
    // never actually applied anywhere — every route was unlimited. Register
    // it globally so both the default limit and the per-route overrides
    // take effect. @Public() routes (see common/decorators) are NOT exempt
    // from throttling by default — that's intentional, since the Konnect
    // webhook and login/mfa are exactly the public routes most worth
    // rate-limiting.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
