# apps/web

React 19 + Vite SPA (package `web`) for The Agents Org. TanStack Router (file-based) + TanStack Query via
`@truyenmoinhu/query`, UI from `@truyenmoinhu/uikit` + Tailwind 4, forms from `@truyenmoinhu/form`,
i18next (`vi`, `en`), zustand for UI state, socket.io for daemon streams.

## Rules (read before editing apps/web/**)

Scoped to package `web` only; do not apply them to daemon, infrastructure or external packages.

- [Architecture, component files, export portals](.agents/rules/web-architecture.md)
- [TypeScript and control flow](.agents/rules/web-typescript.md)
- [UI, forms and i18n](.agents/rules/web-ui-forms.md)
- [Queries and mutations](.agents/rules/web-data.md)

## Skills (must use)

- New feature module → `web-create-module` (`python3 .agents/skills/web-create-module/scripts/create_module.py <name>`).
  Do not create `src/modules/<name>/` by hand.
- New component → `web-create-component` (`.agents/skills/web-create-component/SKILL.md`).
- Verify visible changes in a browser → `web-browser-testing` (`.agents/skills/web-browser-testing/SKILL.md`).

## Layout

```
src/
  main.tsx, router.ts     # bootstrap: providers, API manager, router
  routes/                 # TanStack file routes (.ts or .tsx); index route is home.ts (indexToken 'home')
  routeTree.gen.ts        # generated — never edit; `pnpm --filter web generate-routes`
  layouts/                # app shell (Layout)
  components/<Name>/      # shared UI, no feature imports; <Name>.tsx + index.ts portal
  modules/<feature>/      # feature code: <Component>.tsx, hooks.ts, constants.ts, types.ts, utils.ts, error.ts, index.ts
  hooks/ stores/ utils/ constants/ i18n/ @types/
```

Dependency direction: `types/utils/constants → stores → hooks → components → layouts/modules → routes`.
Import across areas with aliases (`#components`, `#modules/<feature>`, `#hooks`, `#utils`, `#constants`, `#i18n`,
`#layouts`), never `/index`. Inside a module use relative imports.

Current modules: `agents`, `dashboard`, `projects`, `system`, `tickets`, `workspaces`.

## Daemon API

Requests go through `apiManager` from the query/mutation callback context to `VITE_APP_BASE_API_URL` +
`api/v1`. In dev, Vite (port 3000) proxies `/api` to `API_PROXY_TARGET` (daemon on `127.0.0.1:3005`).

## Commands (from repo root)

```bash
pnpm --filter web dev
rtk pnpm --filter web audit:codestyle      # house rules (scripts/audit-codestyle.cjs)
rtk proxy pnpm --filter web typecheck
rtk pnpm --filter web exec biome check .
rtk pnpm --filter web build
```

There is no unit test runner in web; do not use root `pnpm test`. UI changes need `web-browser-testing`.
