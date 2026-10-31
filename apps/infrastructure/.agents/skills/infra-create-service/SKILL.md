---
name: infra-create-service
description: Use when adding a new local service (database, cache, queue, mail catcher, object storage...) to apps/infrastructure, or when asked for a new docker-compose service managed by `make up-<service>`.
---

# Create an infrastructure service

## Overview
Each service is a sibling directory of `apps/infrastructure/postgres/` with `docker-compose.yml` and
`.env.example`; `compose.py` discovers it automatically, so the Makefile never changes.
The script reproduces the postgres conventions: loopback-only port, `x-volume-path` bind mount guarded by
`compose.py`, shared `agent_org_network`, `restart: unless-stopped`.

## Usage
From `apps/infrastructure`:

```bash
# stateful (persists <data-dir> to VOLUME_PATH)
python3 .agents/skills/infra-create-service/scripts/create_service.py redis --image redis:7-alpine --port 6379 --data-dir /data
# stateless
python3 .agents/skills/infra-create-service/scripts/create_service.py mailpit --image axllent/mailpit:latest --port 8025
```

`--dry-run` previews; `--self-test` checks the script. It refuses non-kebab names, relative `--data-dir`
and existing directories. Port is published as `127.0.0.1:${<NAME>_PORT:-<port>}:<port>`.

## After scaffolding
1. Add required env vars under `environment:` with `${VAR:?VAR is required}` and list them in `.env.example`
   (no real secrets in `.env.example`).
2. Add a `healthcheck` when the image supports one (postgres uses `pg_isready`).
3. `cp <name>/.env.example <name>/.env.development` and set an absolute, dedicated `VOLUME_PATH`.
4. Test with the `infra-run-tests` skill (static, then `--smoke <name>`).
5. Document the service and how apps connect to it in `apps/infrastructure/README.md`.

## Common mistakes
- Publishing on `0.0.0.0` (drop `127.0.0.1:`) — exposes the service on the LAN.
- Bind mount without `x-volume-path` — `compose.py` rejects it.
- Committing `.env.<environment>` files — only `.env.example` is tracked.
