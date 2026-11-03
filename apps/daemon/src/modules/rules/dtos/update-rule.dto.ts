import { PartialType } from '@nestjs/swagger';

import { SaveRuleDto } from './save-rule.dto';

export class UpdateRuleDto extends PartialType(SaveRuleDto) {}
