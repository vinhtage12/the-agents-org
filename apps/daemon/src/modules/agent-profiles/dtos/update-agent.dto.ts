import { PartialType } from '@nestjs/swagger';

import { SaveAgentDto } from './save-agent.dto';

export class UpdateAgentDto extends PartialType(SaveAgentDto) {}
