export enum AgentRole {
  BA = 'BA',
  DEV = 'DEV',
  QC = 'QC',
  FILE_PROCESSOR = 'FILE_PROCESSOR'
}

export enum BranchKind {
  CHECKOUT_BASE = 'CHECKOUT_BASE',
  PR_TARGET = 'PR_TARGET',
  NONE = 'NONE'
}

export enum AgentProvider {
  CLAUDE = 'claude',
  CODEX = 'codex',
  COPILOT = 'copilot',
  AGY = 'agy'
}
