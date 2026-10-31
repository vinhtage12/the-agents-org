# Daemon modules

Applies to `apps/daemon/**` only.

Every new daemon domain module MUST be created using the `daemon-create-module`
skill and its script. Never scaffold a daemon module by hand or with `nest g`.

Read [the skill](../skills/daemon-create-module/SKILL.md), then from that skill's
directory run:

```sh
python3 scripts/create_module.py audit-logs --dry-run
python3 scripts/create_module.py audit-logs
```

The script resolves the daemon package from its own location, so invocation is
independent of the caller's working directory. Use a lowercase kebab-case name.
Existing modules are rejected; extend their files instead of regenerating them.

Keep controller/service specs beside their source and DTO classes in `dtos/`.
Module files belong at `src/modules/<name>/<name>.module.ts` and are imported by
`src/modules/app.module.ts`. Add imports/exports explicitly when another module
consumes a service. Do not make every module global.

After scaffolding, implement and test behavior, then run daemon build, test, and
check. Remove unused placeholders only when real files replace them. Existing
modules may be reorganized without creating new endpoint behavior.
