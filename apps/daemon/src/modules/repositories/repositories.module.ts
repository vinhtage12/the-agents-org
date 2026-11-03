import { Module } from '@nestjs/common';

import { GitModule } from '../git/git.module';
import { RepositoriesController } from './controllers/repositories.controller';
import { RepositoriesService } from './services/repositories.service';

@Module({
  imports: [GitModule],
  controllers: [RepositoriesController],
  providers: [RepositoriesService],
  exports: [RepositoriesService]
})
export class RepositoriesModule {}
