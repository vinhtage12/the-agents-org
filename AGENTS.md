# Repository Guidelines

## Project Structure

This pnpm workspace keeps applications under `apps/`: `web/` is the React, Vite, and TanStack Router frontend; `daemon/` is the NestJS API with Prisma schema and migrations in `apps/daemon/prisma/`; and `infrastructure/` contains local service configuration and a Makefile. Frontend routes live in `apps/web/src/routes/`, shared UI in `components/`, and feature code in `modules/`. Tests currently live beside daemon source as `*.spec.ts`, with end-to-end tests in `apps/daemon/test/`.

## Build, Test, and Development

Run `pnpm install` from the repository root. `pnpm dev` starts workspace development servers; use `pnpm --filter web dev` or `pnpm --filter daemon dev` to start one app. Build with `pnpm --filter web build` or `pnpm --filter daemon build`. Run daemon tests with `pnpm --filter daemon test` and end-to-end tests with `pnpm --filter daemon test:e2e`. `pnpm check` runs workspace checks. Root `pnpm test` is a placeholder and currently exits with an error. The web app has no test script yet.

## Style and Organization

Use TypeScript and follow the Biome configuration in the root and app directories. `pnpm format` formats workspace files; `pnpm lint` runs configured lint commands, which may apply fixes. For frontend features, follow `apps/web/src/modules/README.md`: keep modules under `src/modules/<name>/`, expose them through `index.ts`, and respect the documented one-way dependency layers. Add routes as files in `src/routes/`; do not hand-edit generated `routeTree.gen.ts`.

## Tests and Configuration

Name daemon unit tests `*.spec.ts` and e2e tests `*.e2e-spec.ts`. Add or update tests when changing daemon behavior. Copy `.env.example` to a local environment file and configure database/API settings as needed; never commit secrets. Prisma changes belong in the schema and a migration.

## Commits and Pull Requests

Recent history uses short imperative summaries (for example, `Setup web`). Lefthook prefixes commit subjects with the branch name, such as `feat/abc` becoming `feat(abc): ...`. Keep pull requests focused, describe behavior and validation commands, link related issues, and include screenshots for visible frontend changes.

## Scoped Agent Rules

Before editing `apps/web`, read the applicable files in `.agent/rules/`: [architecture](.agent/rules/web-architecture.md), [TypeScript](.agent/rules/web-typescript.md), [UI/forms/i18n](.agent/rules/web-ui-forms.md), and [queries/mutations](.agent/rules/web-data.md). These rules apply to package `web` only; do not apply them to daemon, infrastructure or external packages. See each file's scope and exclusions.
