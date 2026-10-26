import { defineConfig, env } from 'prisma/config';

// Production gets real env vars; locally read the dev env file.
if (process.env.NODE_ENV !== 'production') {
  process.loadEnvFile('.env.development');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') }
});
