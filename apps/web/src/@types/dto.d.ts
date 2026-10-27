declare module 'dto/types' {
  export interface IHealth {
    status: 'ok';
    db: 'up' | 'down';
  }
}
