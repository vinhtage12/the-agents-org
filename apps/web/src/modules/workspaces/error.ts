export class WorkspaceError extends Error {
  constructor(readonly status?: number) {
    super('Workspace request failed');
  }
}
