import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AgentRunsService } from '../services/agent-runs.service';

@Controller('agent-runs')
@ApiTags('agent-runs')
export class AgentRunsController {
  constructor(readonly service: AgentRunsService) {}
}
