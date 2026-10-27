export interface Env {
  DATABASE_URL: string;
  PORT: number;
  CORS_ORIGIN: string[];
}

export function validate(config: Record<string, unknown>): Env {
  const { DATABASE_URL, PORT, CORS_ORIGIN } = config;

  if (typeof DATABASE_URL !== 'string' || !DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const port = Number(PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer, got "${PORT}"`);
  }

  // Comma-separated list of allowed web origins.
  const corsOrigin = String(CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  return { DATABASE_URL, PORT: port, CORS_ORIGIN: corsOrigin };
}
