import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

import type { Env } from './configuration/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }), '127.0.0.1');
}
bootstrap();
