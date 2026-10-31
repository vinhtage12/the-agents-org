import {
  Controller,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AllowWithoutClientHeader } from '../../../common/decorators/allow-without-client-header.decorator';
import { AgentRunsService } from '../services/agent-runs.service';

@Controller('agent-runs')
@ApiTags('agent-runs')
export class AgentRunsController {
  constructor(private readonly agentRuns: AgentRunsService) {}

  // Called by the agent itself (curl) once output.md is written.
  @Post(':id/complete')
  @AllowWithoutClientHeader()
  @HttpCode(204)
  async complete(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-run-token') token: string
  ): Promise<void> {
    await this.agentRuns.complete(id, token);
  }
}
