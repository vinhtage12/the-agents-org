export class ProjectError extends Error {
  constructor(readonly status?: number) {
    super('Project request failed');
  }
}
