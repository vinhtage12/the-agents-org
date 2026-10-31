---
name: web-create-module
description: Use when adding a new feature module, page or domain area to apps/web (src/modules/<name>), before creating any files under src/modules by hand.
---

# Create a web module

## Overview
New feature modules in `apps/web` are scaffolded by a script so they start compliant with
`apps/web/.agents/rules/web-*.md` (portal `index.ts`, one component per `.tsx`, query hook with
`apiManager` from context, error class, i18n keys in `vi` + `en`).

## Usage
From `apps/web`:

```bash
python3 .agents/skills/web-create-module/scripts/create_module.py <kebab-name> --dry-run   # preview
python3 .agents/skills/web-create-module/scripts/create_module.py <kebab-name>
```

The script refuses non-kebab names, an existing `src/modules/<name>/` and an existing i18n key,
then runs `biome check --write` on the new folder. `--self-test` checks the script itself.

Generated (`agent-runs` → `AgentRuns`):

| File | Content |
|---|---|
| `types.ts` | `IAgentRuns` entity interface |
| `constants.ts` | `AGENT_RUNS_QUERY_KEYS`, `AGENT_RUNS_ENDPOINTS` (`withGenerateEndpoint('agent-runs')`) |
| `error.ts` | `AgentRunsError(status)` |
| `hooks.ts` | `useAgentRunsList` via `useQueryEnhancer` |
| `AgentRunsPage.tsx` | loading / error / empty states with `trans('agent_runs.*')` |
| `index.ts` | re-exports only |

## After scaffolding
1. Replace the placeholder entity fields and endpoint path with the real daemon contract.
2. Add more components with the `web-create-component` skill.
3. Expose a page through a route file in `src/routes/` (`.ts` or `.tsx`), importing from `#modules/<name>`,
   then `pnpm --filter web generate-routes`. Add a menu entry in `src/constants/menu.ts` if needed.
4. Verify:
   ```bash
   rtk pnpm --filter web audit:codestyle
   rtk proxy pnpm --filter web typecheck
   rtk pnpm --filter web exec biome check .
   ```

## Common mistakes
- Creating `src/modules/<name>/index.tsx` or putting logic in `index.ts` — the audit rejects it.
- Hardcoding UI strings instead of adding keys to both locale files.
- Importing another module's files directly instead of `#modules/<other>`.
