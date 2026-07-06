"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const event_emitter_1 = require("@nestjs/event-emitter");
const schedule_1 = require("@nestjs/schedule");
const configuration_1 = require("./config/configuration");
const database_module_1 = require("./database/database.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const policy_module_1 = require("./policy/policy.module");
const universities_module_1 = require("./universities/universities.module");
const partners_module_1 = require("./partners/partners.module");
const students_module_1 = require("./students/students.module");
const membership_module_1 = require("./membership/membership.module");
const digital_pass_module_1 = require("./digital-pass/digital-pass.module");
const applications_module_1 = require("./applications/applications.module");
const pipeline_module_1 = require("./pipeline/pipeline.module");
const score_module_1 = require("./score/score.module");
const documents_module_1 = require("./documents/documents.module");
const contracts_module_1 = require("./contracts/contracts.module");
const guarantors_module_1 = require("./guarantors/guarantors.module");
const payments_module_1 = require("./payments/payments.module");
const collections_module_1 = require("./collections/collections.module");
const execution_module_1 = require("./execution/execution.module");
const notifications_module_1 = require("./notifications/notifications.module");
const reports_module_1 = require("./reports/reports.module");
const ai_module_1 = require("./ai/ai.module");
const tenant_interceptor_1 = require("./common/interceptors/tenant.interceptor");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [configuration_1.configuration],
                validationSchema: configuration_1.configValidationSchema,
            }),
            throttler_1.ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
            event_emitter_1.EventEmitterModule.forRoot(),
            schedule_1.ScheduleModule.forRoot(),
            database_module_1.DatabaseModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            policy_module_1.PolicyModule,
            universities_module_1.UniversitiesModule,
            partners_module_1.PartnersModule,
            students_module_1.StudentsModule,
            membership_module_1.MembershipModule,
            digital_pass_module_1.DigitalPassModule,
            applications_module_1.ApplicationsModule,
            pipeline_module_1.PipelineModule,
            score_module_1.ScoreModule,
            documents_module_1.DocumentsModule,
            contracts_module_1.ContractsModule,
            payments_module_1.PaymentsModule,
            guarantors_module_1.GuarantorsModule,
            collections_module_1.CollectionsModule,
            execution_module_1.ExecutionModule,
            notifications_module_1.NotificationsModule,
            reports_module_1.ReportsModule,
            ai_module_1.AiModule,
        ],
        providers: [
            { provide: core_1.APP_INTERCEPTOR, useClass: tenant_interceptor_1.TenantInterceptor },
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map