---
name: infra-run-tests
description: Use when changing or adding anything in apps/infrastructure (docker-compose.yml, .env.example, compose.py, Makefile) and before claiming an infrastructure change works.
---

# Run infrastructure tests

## Overview
Two levels, both from `apps/infrastructure`:

| Command | Checks | Side effects |
|---|---|---|
| `python3 .agents/skills/infra-run-tests/scripts/run_tests.py` | `docker compose config` for every service using its `.env.example` (syntax, required vars, interpolation) | none |
| `python3 .agents/skills/infra-run-tests/scripts/run_tests.py --smoke <service> --env development` | `make up-<service>`, waits until every container is `running` and `healthy`, then `make down-<service>` | starts containers; creates `VOLUME_PATH` if missing |

Exit code is non-zero on failure; failing services print compose errors or the last 50 log lines.

## Rules
- Run static first; run smoke for every service you touched.
- If the service is already running (e.g. the daemon's postgres), smoke only checks health and leaves it running.
- Smoke never calls `remove-*` (that deletes data). Do not add it.
- Smoke needs `<service>/.env.<env>`; create it from `.env.example` with a dedicated absolute `VOLUME_PATH`.
- Script changes to `compose.py` → also exercise the failure paths by hand (missing env file, unsafe `VOLUME_PATH`).
- `--timeout <seconds>` (default 90) for slow images.
