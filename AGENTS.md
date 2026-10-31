# Repository Guidelines

The Agents Org: a local control plane for coding agents. A NestJS daemon talks to Herdr (terminal multiplexer
for agents), Jira and PostgreSQL; a React web app is its dashboard.

## Project structure

pnpm workspace (`pnpm-workspace.yaml`: `apps/*`, `packages/*`):

| Path | What | Guide |
|---|---|---|
| `apps/daemon/` | NestJS 11 API, Prisma 7 + PostgreSQL, Socket.IO gateway, Jest. `src/modules/<domain>/`, `src/common/`, `src/configuration/`, `src/database/` | [apps/daemon/AGENTS.md](apps/daemon/AGENTS.md) |
| `apps/web/` | React 19 + Vite SPA, TanStack Router/Query, `@truyenmoinhu/*` UI kit, i18n `vi`/`en` | [apps/web/AGENTS.md](apps/web/AGENTS.md) |
| `apps/infrastructure/` | Docker Compose services (postgres) driven by `make` + `compose.py`; not a pnpm package | [apps/infrastructure/AGENTS.md](apps/infrastructure/AGENTS.md) |
| `docs/` | Specs and plans (`docs/superpowers/`) | — |

Runtime: web (Vite :3000) proxies `/api` → daemon (`127.0.0.1:3005`, prefix `api/v1`) → postgres (`127.0.0.1:5432`).

**Before editing inside an app, read that app's `AGENTS.md` and the rules it links** (each app keeps its rules in
`apps/<app>/.agents/rules/`). App rules apply only to that app.

## Skills

Skill sources live next to the code they serve (`apps/<app>/.agents/skills/`); `.agents/skills/` and
`.claude/skills/` at the root are symlinks so every agent finds them from the repo root.

| Skill | Use for |
|---|---|
| `daemon-create-module` | **Required** for any new daemon module |
| `daemon-testing` | Writing and running daemon unit/e2e tests |
| `web-create-module` | **Required** for any new web feature module |
| `web-create-component` | Standard web component |
| `web-browser-testing` | Verifying web UI changes in a browser |
| `infra-create-service` | **Required** for any new infrastructure service |
| `infra-run-tests` | Testing infrastructure changes |
| `repo-quality-checks` | Format, lint and type-check before finishing |

Migrations: follow [apps/daemon/.agents/rules/daemon-migrations.md](apps/daemon/.agents/rules/daemon-migrations.md).
To add a skill: create it under the owning app, then symlink it into both root directories
(`ln -s ../../apps/<app>/.agents/skills/<name> .agents/skills/<name>` and the same for `.claude/skills/`).

## Build, test and development

```bash
pnpm install                       # also runs prisma generate for daemon
pnpm dev                           # all dev servers; or pnpm --filter web|daemon dev
pnpm --filter web build            # / pnpm --filter daemon build
pnpm --filter daemon test          # unit; test:e2e for e2e
python3 .agents/skills/repo-quality-checks/scripts/check.py   # format + lint + typecheck, check only
```

Root `pnpm test` is a placeholder that exits with an error. `pnpm format` / `pnpm lint` write fixes across apps.

## Style

TypeScript everywhere, formatted and linted by Biome (root `biome.json` + per-app configs extending
`@truyenmoinhu/biome-config`). Python 3 stdlib only for skill scripts. Never commit secrets: copy
`.env.example` to `.env.<environment>` (git-ignored).

## Commits and pull requests

Short imperative summaries. Lefthook runs `pnpm format` and `pnpm lint` on pre-commit and prefixes commit
subjects with the branch (`feat/abc` → `feat(abc): ...`). Keep PRs focused, describe behavior and validation
commands, link issues, and include screenshots for visible frontend changes.

## Working alongside other agents

Several agents may work in this repo at once (Herdr panes). Stay inside the app you were assigned; before editing
shared files (root configs, this file, `pnpm-lock.yaml`), wait until other panes touching them are idle.
