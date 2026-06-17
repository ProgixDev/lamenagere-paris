import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    // rawBody exposes req.rawBody (Buffer) for Stripe webhook signature checks.
    { rawBody: true },
  );

  const config = app.get(ConfigService);

  // Multipart for media uploads (admin product images + videos, quote photos).
  await app.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB (videos)
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Permissive CORS: reflect any origin and allow every method. Requested
  // headers are reflected automatically. Auth is bearer-token based (no cookies),
  // so the API does not rely on CORS for protection.
  app.enableCors({
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  });

  // Port comes from the hosting platform (PORT env) or .env locally; 3000 fallback.
  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 lamenagere-backend listening on :${port}`, 'Bootstrap');
}

void bootstrap();
