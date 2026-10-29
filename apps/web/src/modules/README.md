# Modules

See the scoped rules in [web architecture](../../../../.agent/rules/web-architecture.md).

One folder per feature under `src/modules/<name>/`. Every component has its own PascalCase `.tsx` file. There are no `index.tsx` files; `index.ts` is exclusively a portal that re-exports the module's components, hooks, types, constants and helpers.

Small modules can use flat files (`types.ts`, `constants.ts`, `hooks.ts`, `utils.ts`, `error.ts`). Larger modules can group these responsibilities into `components/`, `hooks/`, `constants/` and `utils/` directories. Import a module through its public portal from outside; use relative imports within it.

Shared-layer dependencies flow one way: `types/utils/constants → stores → hooks → components → layouts/modules → routes`. Compose feature modules in layouts/modules/routes; shared components must not import feature modules.
