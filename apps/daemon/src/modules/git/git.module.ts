import { Module } from '@nestjs/common';

import { GitService } from './services/git.service';

@Module({
  providers: [GitService],
  exports: [GitService]
})
export class GitModule {}
