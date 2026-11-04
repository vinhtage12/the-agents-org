import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AllowWithoutClientHeader } from '#common/decorators/allow-without-client-header.decorator';

import { ScheduledRunnerService } from '../services/scheduled-runner.service';

@Controller('scheduled-runs')
@ApiTags('scheduled-runs')
export class ScheduledRunsController {
  constructor(private readonly runner: ScheduledRunnerService) {}
  @Get('attention') attention() {
    return this.runner.attention();
  }
  @Get(':id/output') output(@Param('id', ParseIntPipe) id: number) {
    return this.runner.output(id);
  }
  @Post(':id/rerun') rerun(@Param('id', ParseIntPipe) id: number) {
    return this.runner.rerun(id);
  }
  @Post(':id/dismiss') @HttpCode(204) dismiss(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.runner.dismiss(id);
  }
  @Post(':id/stop') stop(@Param('id', ParseIntPipe) id: number) {
    return this.runner.stop(id);
  }
  @Post(':id/complete')
  @AllowWithoutClientHeader()
  @HttpCode(204)
  complete(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-run-token') token: string
  ) {
    return this.runner.complete(id, token);
  }
}
