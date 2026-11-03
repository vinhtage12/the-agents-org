import { PartialType } from '@nestjs/swagger';

import { CreateRepoDto } from './create-repo.dto';

export class UpdateRepoDto extends PartialType(CreateRepoDto) {}
