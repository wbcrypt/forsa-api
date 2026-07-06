"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const compression_1 = __importDefault(require("compression"));
const app_module_1 = require("./app.module");
const global_exception_filter_1 = require("./common/filters/global-exception.filter");
const config_1 = require("@nestjs/config");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    const config = app.get(config_1.ConfigService);
    const isProd = config.get('env') === 'production';
    const apiPrefix = config.get('apiPrefix') || 'api/v1';
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: isProd,
        crossOriginEmbedderPolicy: isProd,
    }));
    app.use((0, cookie_parser_1.default)());
    app.use((0, compression_1.default)());
    const corsOrigins = config.get('security.corsOrigins') || [];
    app.enableCors({
        origin: isProd ? corsOrigins : true,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-device-fingerprint'],
    });
    app.setGlobalPrefix(apiPrefix);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalFilters(new global_exception_filter_1.GlobalExceptionFilter());
    app.useGlobalInterceptors(new common_1.ClassSerializerInterceptor(app.get(core_1.Reflector)));
    if (!isProd) {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('FORSA OS API')
            .setDescription('Educational Financing ERP/CRM — Internal API')
            .setVersion('1.0')
            .addBearerAuth()
            .addCookieAuth('forsa_session')
            .addTag('Authentication')
            .addTag('Users')
            .addTag('Policy Engine')
            .addTag('Universities')
            .addTag('Partners & Referrals')
            .addTag('Students')
            .addTag('Applications')
            .addTag('Financing Decision Pipeline')
            .addTag('FORSA Score Engine')
            .addTag('Documents')
            .addTag('Contracts')
            .addTag('Payments')
            .addTag('Collections')
            .addTag('Decision Execution Engine')
            .addTag('Notifications')
            .addTag('Reports & Analytics')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
            swaggerOptions: { persistAuthorization: true },
        });
        logger.log(`Swagger: http://localhost:${config.get('port')}/${apiPrefix}/docs`);
    }
    const port = config.get('port') || 3000;
    await app.listen(port, '0.0.0.0');
    logger.log(`FORSA OS running on port ${port} [${config.get('env')}]`);
    logger.log(`API prefix: /${apiPrefix}`);
}
bootstrap().catch(err => {
    console.error('Fatal: failed to start', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map