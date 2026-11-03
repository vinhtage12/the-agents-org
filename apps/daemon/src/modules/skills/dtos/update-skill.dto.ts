import { PartialType } from '@nestjs/swagger';

import { SaveSkillDto } from './save-skill.dto';

export class UpdateSkillDto extends PartialType(SaveSkillDto) {}
