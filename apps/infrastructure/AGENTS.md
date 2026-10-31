# apps/infrastructure

Local backing services for the workspace (currently PostgreSQL), run with Docker Compose. Not a pnpm package.

## Layout

```
apps/infrastructure/
  Makefile          # make <up|down|remove>-<service> -- --<environment>
  compose.py        # resolves <service>/.env.<environment>, validates VOLUME_PATH, runs docker compose
  postgres/
    docker-compose.yml
    .env.example    # tracked template; .env.<environment> files are local and git-ignored
  <service>/        # any sibling dir with docker-compose.yml is a service; no Makefile changes
```

- Compose project name: `agents-<service>-<environment>`.
- Ports are published on `127.0.0.1` only. Daemon connects with `DATABASE_URL=...@localhost:<POSTGRES_PORT>/...`;
  containers on `agent_org_network` use host `postgres:5432`.
- Persistent data uses `x-volume-path: ${VOLUME_PATH:?...}` and a bind mount with `create_host_path: false`.
  `compose.py` refuses relative, shallow, symlinked or home/repo paths.
- `down` keeps data; `remove` deletes the data directory. Never run `remove-*` unless the user asks.

## Commands

```bash
cd apps/infrastructure
cp postgres/.env.example postgres/.env.development   # set credentials + VOLUME_PATH
make up-postgres -- --development
make down-postgres -- --development
```

## Skills (must use)

- New service → `infra-create-service` (`.agents/skills/infra-create-service/`). Do not hand-write a new service directory.
- Verify any change → `infra-run-tests` (`.agents/skills/infra-run-tests/`).

## Conventions

- Python 3 stdlib only for scripts; no extra dependencies.
- Never commit `.env.<environment>` or real credentials.
- Document new services and their connection settings in `README.md`.
