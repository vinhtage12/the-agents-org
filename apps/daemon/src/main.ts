import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import packageJson from '../package.json';
import { AppModule } from './modules/app.module';

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

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('The Agents Org daemon')
      .setVersion(packageJson.version)
      .build()
  );
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.get('PORT', { infer: true }), '127.0.0.1');
}
bootstrap();
