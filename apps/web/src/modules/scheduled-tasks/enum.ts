export enum ScheduledRunStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  STOPPED = 'STOPPED',
  MISSED = 'MISSED',
  SKIPPED = 'SKIPPED'
}

export enum ScheduledRunTrigger {
  SCHEDULE = 'SCHEDULE',
  MANUAL = 'MANUAL',
  RERUN = 'RERUN'
}
