import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './configuration/env.validation';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.development',
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      validate
    }),
    PrismaModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
