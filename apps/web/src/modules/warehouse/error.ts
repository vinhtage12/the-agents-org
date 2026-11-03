export class WarehouseError extends Error {
  constructor(
    readonly status?: number,
    message?: string
  ) {
    super(message || 'Warehouse request failed');
  }
}
