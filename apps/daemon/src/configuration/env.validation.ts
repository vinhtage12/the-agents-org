export interface Env {
  DATABASE_URL: string;
  PORT: number;
  CORS_ORIGIN: string[];
  HERDR_SOCKET_PATH?: string;
  HERDR_BIN_PATH?: string;
}

export function validate(config: Record<string, unknown>): Env {
  const { DATABASE_URL, PORT, CORS_ORIGIN, HERDR_SOCKET_PATH, HERDR_BIN_PATH } =
    config;

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

  if (
    HERDR_SOCKET_PATH !== undefined &&
    typeof HERDR_SOCKET_PATH !== 'string'
  ) {
    throw new Error('HERDR_SOCKET_PATH must be a string');
  }
  if (HERDR_BIN_PATH !== undefined && typeof HERDR_BIN_PATH !== 'string') {
    throw new Error('HERDR_BIN_PATH must be a string');
  }

  return {
    DATABASE_URL,
    PORT: port,
    CORS_ORIGIN: corsOrigin,
    HERDR_SOCKET_PATH: HERDR_SOCKET_PATH as string | undefined,
    HERDR_BIN_PATH: HERDR_BIN_PATH as string | undefined
  };
}
