import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import compression from 'compression';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const isProd = config.get('env') === 'production';
  const apiPrefix = config.get<string>('apiPrefix') || 'api/v1';

  // ── Security middleware ───────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: isProd,
    crossOriginEmbedderPolicy: isProd,
  }));

  app.use(cookieParser());
  app.use(compression());

  // CORS — explicit allowlist only
  const corsOrigins = config.get<string[]>('security.corsOrigins') || [];
  app.enableCors({
    origin: isProd ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-device-fingerprint'],
  });

  // ── Global setup ──────────────────────────────────────────────
  app.setGlobalPrefix(apiPrefix);

  // Validation pipe — strict mode, whitelist unknown fields
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false, // Log but don't block (some DTOs use 'any')
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // Global exception filter — OWASP-safe error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Serialize entities (hides @Exclude() fields like passwordHash)
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ── Swagger (disabled in production) ─────────────────────────
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
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

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`Swagger: http://localhost:${config.get('port')}/${apiPrefix}/docs`);
  }

  // ── Start ─────────────────────────────────────────────────────
  const port = config.get<number>('port') || 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`FORSA OS running on port ${port} [${config.get('env')}]`);
  logger.log(`API prefix: /${apiPrefix}`);
}

bootstrap().catch(err => {
  console.error('Fatal: failed to start', err);
  process.exit(1);
});
