export enum AgentStreamEventType {
  AGENT = 'agent',
  STATUS = 'status',
  OUTPUT = 'output',
  CLOSED = 'closed',
  ERROR = 'error'
}

export enum AgentKind {
  CLAUDE = 'claude',
  CODEX = 'codex',
  COPILOT = 'copilot',
  ANTIGRAVITY = 'antigravity'
}

export enum SplitDirection {
  RIGHT = 'right',
  DOWN = 'down'
}
