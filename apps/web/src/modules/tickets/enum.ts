export enum TicketStatus {
  TODO = 'TODO',
  IN_SPEC = 'IN_SPEC',
  IN_REVIEW_SPEC = 'IN_REVIEW_SPEC',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_TESTING = 'IN_TESTING',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  CANCELED = 'CANCELED'
}

export enum TicketSource {
  JIRA = 'JIRA',
  LOCAL = 'LOCAL'
}

export enum TicketSpecMode {
  FILE = 'file',
  TEXT = 'text'
}

export enum BoardLabel {
  RUNNING = 'running',
  APPROVED = 'approved',
  NEEDS_YOU = 'needs_you'
}

export enum AgentStep {
  SPEC = 'SPEC',
  DEV = 'DEV',
  TEST = 'TEST'
}

export enum AgentRunStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  STOPPED = 'STOPPED'
}

export enum TestMode {
  WRITE_CASES = 'WRITE_CASES',
  RUN_CASES = 'RUN_CASES'
}

export enum SprintState {
  FUTURE = 'FUTURE',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED'
}
