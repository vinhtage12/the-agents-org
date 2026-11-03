import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { SystemService } from '../services/system.service';

@Controller('system')
@ApiTags('system')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get('docker')
  docker() {
    return this.system.docker();
  }

  @Get('agent-usage')
  usage() {
    return this.system.usage();
  }
}
