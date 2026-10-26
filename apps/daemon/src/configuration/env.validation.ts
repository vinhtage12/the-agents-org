export interface Env {
  DATABASE_URL: string;
  PORT: number;
}

export function validate(config: Record<string, unknown>): Env {
  const { DATABASE_URL, PORT } = config;

  if (typeof DATABASE_URL !== 'string' || !DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const port = Number(PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer, got "${PORT}"`);
  }

  return { DATABASE_URL, PORT: port };
}
