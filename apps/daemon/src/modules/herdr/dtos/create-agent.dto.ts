import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class CreateAgentDto {
  @IsIn(['claude', 'codex', 'copilot', 'agy', 'antigravity'])
  agent!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9:_-]{1,128}$/)
  parentPaneId?: string;

  @IsOptional()
  @IsIn(['right', 'down'])
  direction?: 'right' | 'down';
}
