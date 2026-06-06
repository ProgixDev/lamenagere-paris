import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

/**
 * Builds and initializes the Nest (Fastify) app WITHOUT calling listen(), for
 * use as a serverless function (Vercel). The instance is cached across warm
 * invocations. The compiled output (dist/serverless.js) is imported by
 * api/index.ts so decorator metadata is already emitted by tsc.
 */
let appPromise: Promise<NestFastifyApplication> | null = null;

async function create(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Smaller cap than the standalone server: Vercel functions have a request
  // body limit (~4.5 MB Hobby). Large videos should upload directly to Supabase
  // Storage from the client; this covers images/docs.
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  });

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

export async function getApp(): Promise<NestFastifyApplication> {
  if (!appPromise) appPromise = create();
  return appPromise;
}
