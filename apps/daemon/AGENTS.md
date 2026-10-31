# Daemon development

Scope: `apps/daemon/**`. This package is a NestJS 11 API using Prisma 7,
PostgreSQL, Jest, and pnpm. Keep changes inside this package when assigned daemon
work; the web app may be edited concurrently.

## Architecture

```text
src/
  main.ts                    # bootstrap, prefix, CORS, validation, shutdown
  common/
    decorators/ filters/ guards/ interceptors/ pipes/ constants/ types/
  configuration/             # environment validation
  database/                  # PrismaModule, PrismaService, database specs
  generated/                 # generated Prisma client; do not edit
  modules/
    app.module.ts            # composition root
    app.controller.ts        # health endpoint (+ spec)
    app.service.ts
    <domain>/
      <domain>.module.ts
      controllers/           # *.controller.ts and adjacent specs
      services/              # *.service.ts and adjacent specs
      dtos/                  # request validation classes in *.dto.ts
      clients/ gateways/     # corresponding suffixes when present
      utils/                 # helpers without a Nest suffix, e.g. adf.ts
      entities/              # only when needed (scaffolder creates placeholder)
```

Domains currently include agent-profiles, agent-usage, herdr, jira, projects,
system, tickets, and workspaces. Each domain owns a Nest module. AppModule imports
domain modules; export only providers consumed across modules. Import the owning
module when injecting its exported service (e.g. ProjectsModule imports
AgentProfilesModule, TicketsModule imports JiraModule). PrismaModule is global.
Configuration is global and loaded once by AppModule.

Folder names follow the file kind: controllers, services, dtos, clients,
gateways; specs stay beside the source they exercise. Keep root app files in
`modules/` and bootstrap in `src/main.ts`. Extract controller DTO classes into
`dtos/` without changing validation decorators or routes. Workspace project CRUD
currently remains in WorkspacesController; ProjectsModule owns project settings.
Do not relocate routes or change behavior as part of folder cleanup.

## Imports and aliases

Use relative imports as existing modules do; they work in built Node output.
`tsconfig.json` defines `#/*`, `#configuration/*`, `#common/*`, `#constants/*`,
`#interceptors/*`, `#filters/*`, `#guards/*`, `#modules/*`, and `#database/*`.
`#filters/*` points to `src/common/filters/*`. Jest maps these aliases too.
TypeScript paths alone do not make an alias work in production Node; preserve
relative runtime imports unless runtime resolution is configured explicitly.

## Database and configuration

Edit `prisma/schema.prisma`, then create migrations with
`pnpm --filter daemon db:migrate:dev --name <snake_name>` from the repository root.
Never edit an applied migration. Run `pnpm --filter daemon db:generate` after
schema changes; Prisma 7 migrate does not generate the client automatically.
Keep schema and new migration together in the same commit when committing is
authorized. Deploy with `pnpm --filter daemon db:migrate:deploy`.
See [migration rules](.agents/rules/daemon-migrations.md).

The generator continues to output `src/generated/prisma`. Moving the database
service does not change the schema, migrations, or generator output. Local config
comes from `.env.development`; copy `.env.example` and supply the needed values.
Never commit credentials. Jira credentials are optional; unconfigured Sync is 503.

## Commands and testing

Run from the repository root:

- `pnpm --filter daemon dev` — development server.
- `pnpm --filter daemon build` — compile with Nest (entry remains `src/main.ts`).
- `pnpm --filter daemon test` — unit tests, `*.spec.ts` beside source.
- `pnpm --filter daemon test -- tickets` — focused unit tests.
- `pnpm --filter daemon test:cov` — unit coverage.
- `pnpm --filter daemon test:e2e` — `test/*.e2e-spec.ts`.
- `pnpm --filter daemon check` — Biome checks and fixes this package only.

Use Nest TestingModule for dependency injection tests and replace PrismaService
or external clients with mocks. Test module exports/imports in the AppModule
wiring spec. E2e tests use Supertest; the health test needs local PostgreSQL.
Workspace database tests run when `TEST_DATABASE_URL` is set and clean up the
records they create. Use a local/test database, never production. Jest disables
Watchman to avoid a dependency on the local Watchman installation.

## Rules

- [daemon-modules](.agents/rules/daemon-modules.md): every new daemon module MUST
  be created with the daemon-create-module skill/script, never by hand or `nest g`.
- [daemon-migrations](.agents/rules/daemon-migrations.md): schema, migration,
  generation, and deploy workflow.
- [daemon-create-module](.agents/skills/daemon-create-module/SKILL.md): module
  scaffolding and registration; validates names and refuses existing modules.
- [daemon-testing](.agents/skills/daemon-testing/SKILL.md): unit/e2e conventions
  and the test runner.

Follow package Biome configuration. Do not run root format/lint hooks or stage
unrelated files while another pane is working. Honor task instructions about
commits, branches, and pushing.
