// Phase 3.5 (final engineering pass) discovery — must be the very first
// import in this file. auth.controller.ts reads process.env at MODULE
// LOAD time (a static @Throttle() decorator can't read an injected
// ConfigService — see the comment there) to compute the login throttle's
// ttl/limit. AppModule's import chain (AppModule -> AuthModule ->
// AuthController) is resolved and executed BEFORE AppModule's own
// @Module({ imports: [ConfigModule.forRoot(...)] }) decorator ever runs
// — meaning ConfigModule had not yet loaded .env into process.env by the
// time auth.controller.ts's module-level const was evaluated. The
// throttle silently fell back to its hardcoded default (900s/5) in every
// environment, regardless of LOGIN_THROTTLE_TTL_SECONDS/
// LOGIN_THROTTLE_LIMIT — the exact bug the T-110-era fix was meant to
// close. `dotenv/config`'s side effect runs as soon as this import
// statement resolves, before the `./app.module` import below is even
// reached, so process.env is populated in time.
import 'dotenv/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
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
