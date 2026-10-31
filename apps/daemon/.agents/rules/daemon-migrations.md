# Daemon Prisma migrations

Applies to `apps/daemon/**` only. Run commands below from the repository root.

1. Edit `apps/daemon/prisma/schema.prisma`.
2. Ensure `.env.development` points to the intended local PostgreSQL database.
3. Run `pnpm --filter daemon db:migrate:dev --name <snake_name>` (for example,
   `--name add_ticket_priority`). Inspect the generated SQL in
   `apps/daemon/prisma/migrations/<timestamp>_<snake_name>/migration.sql`.
4. Run `pnpm --filter daemon db:generate`. Prisma 7 does not automatically
   regenerate the client during migration. Output stays in
   `apps/daemon/src/generated/prisma`; never hand-edit or commit generated files.
5. Update the matching entity class in its owning module after every schema
   change. Its `implements` clause makes daemon TypeScript compilation enforce
   field parity.
6. Run daemon build and tests. When commits are authorized, commit the schema and
   its newly generated migration together.

Never edit an applied migration; create a new forward migration. Do not reset a
shared database or accept data-loss prompts without explicit authorization.
Deploy committed migrations with `pnpm --filter daemon db:migrate:deploy` against
an explicitly configured deployment database. Do not use migrate dev in production.
The datasource URL is configured through `prisma.config.ts`, which reads local
`.env.development` outside production and environment variables in production.
