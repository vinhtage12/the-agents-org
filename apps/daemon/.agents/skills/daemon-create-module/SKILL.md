---
name: daemon-create-module
description: Use when adding a new domain module to apps/daemon.
---

# Create a daemon module

Read `apps/daemon/AGENTS.md` and `.agents/rules/daemon-modules.md` before adding a
module. Use this script rather than hand scaffolding or `nest g`.

From this skill directory:

```sh
python3 scripts/create_module.py audit-logs --dry-run
python3 scripts/create_module.py audit-logs
```

The script finds `apps/daemon` from its resolved file location, including when
accessed through a skill symlink. It accepts lowercase kebab-case names, refuses
existing module directories or registrations, and previews without writing when
`--dry-run` is passed.

It creates `src/modules/<name>/` with a Nest module, controller/service and
adjacent Nest TestingModule specs, plus a DTO placeholder and an entity class
stub. The controller is tagged with `@ApiTags('<name>')`. It registers the module
in `src/modules/app.module.ts`. If the imports array cannot
be identified, it refuses to write; inspect the composition root before retrying.

Add the requested behavior, request DTOs, dependencies, and tests. Keep entities
only when needed. Export a provider only when another domain consumes it, then
import its owning module there. Do not change unrelated routes or generate Prisma
entities by hand.

Run from the repository root:

```sh
pnpm --filter daemon check
pnpm --filter daemon build
pnpm --filter daemon test
```

To check the scaffolder itself, from this skill directory run:

```sh
python3 scripts/test_create_module.py
```

Do not commit or push unless the task authorizes it.
