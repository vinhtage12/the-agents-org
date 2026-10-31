import { Module } from '@nestjs/common';

import { JiraModule } from '../jira/jira.module';
import { TicketsController } from './controllers/tickets.controller';
import { TicketsService } from './services/tickets.service';

@Module({
  imports: [JiraModule],
  controllers: [TicketsController],
  providers: [TicketsService]
})
export class TicketsModule {}
