# Modules

One folder per feature (`src/modules/<name>/`):

- `components/` — UI of the module, with `types.ts` for component types
- `constants/` — module constants
- `hooks/` — module hooks, with `types.ts` for hook types
- `utils/` — module helpers, with `types.ts` for utility types
- `index.ts` — the module's public entry; import the module only through it

Import layers flow one way, left to right:
`types/utils/constants → stores → hooks → components → layouts / modules → routes`.
A layer may import anything to its left, never to its right. Routes only compose layouts and modules.
