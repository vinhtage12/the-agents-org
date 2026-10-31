---
name: repo-quality-checks
description: Use when about to finish, commit or open a PR for changes in apps/web or apps/daemon, when a pre-commit hook (lefthook) fails, or when asked to lint, format or type-check the workspace.
---

# Lint, format and type-check the workspace

## Overview
One script runs Biome format, Biome lint (+ the web codestyle audit) and `tsc --noEmit` for each app
and prints a PASS/FAIL summary. Default is check-only; nothing is written unless `--fix` is given.

## Usage (from repo root)
```bash
python3 .agents/skills/repo-quality-checks/scripts/check.py                  # all apps, all steps
python3 .agents/skills/repo-quality-checks/scripts/check.py web              # one app
python3 .agents/skills/repo-quality-checks/scripts/check.py daemon --only typecheck
python3 .agents/skills/repo-quality-checks/scripts/check.py web --fix        # Biome writes fixes, then re-checks
```

| Step | web | daemon |
|---|---|---|
| format | `biome format .` | `biome format .` |
| lint | `biome lint .` + `audit:codestyle` | `biome lint .` |
| typecheck | `tsc --noEmit -p tsconfig.json` | `tsc --noEmit -p tsconfig.json` |

Exit code is 0 only when every selected step passes. `apps/infrastructure` is not a pnpm package; use the
`infra-run-tests` skill there.

## Rules
- Use `--fix` only on the app you changed, and review the diff it produces; never mass-format files outside your task.
- Typecheck failures are fixed in code, not with `any`, casts or `@ts-ignore`.
- The root `pnpm lint` / `pnpm format` (lefthook pre-commit) write fixes to every app; prefer this script while another
  agent is editing the workspace.
- Tests are separate: `daemon-testing` (daemon), `web-browser-testing` (web).
