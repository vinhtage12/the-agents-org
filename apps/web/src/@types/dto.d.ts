declare module 'dto/types' {
  export interface IHealth {
    status: 'ok';
    db: 'up' | 'down';
  }

  export interface IAgent {
    id: string;
    paneId: string;
    agent: string;
    status: 'idle' | 'working' | 'blocked' | 'done' | 'unknown' | string;
    workspaceId?: string;
    tabId?: string;
    title?: string;
    cwd?: string;
  }
}
