import { Module } from '@nestjs/common';

import { HerdrClient } from './clients/herdr.client';
import { HerdrController } from './controllers/herdr.controller';
import { HerdrGateway } from './gateways/herdr.gateway';
import { HerdrService } from './services/herdr.service';

@Module({
  controllers: [HerdrController],
  providers: [HerdrClient, HerdrService, HerdrGateway],
  exports: [HerdrService]
})
export class HerdrModule {}
