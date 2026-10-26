import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

import type { Env } from './configuration/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(
    app.get(ConfigService<Env, true>).get('PORT', { infer: true })
  );
}
bootstrap();
