import { PartialType } from '@nestjs/swagger';

import { SaveScheduledTaskDto } from './save-scheduled-task.dto';

export class UpdateScheduledTaskDto extends PartialType(SaveScheduledTaskDto) {}
