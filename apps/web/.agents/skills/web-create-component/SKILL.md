---
name: web-create-component
description: Use when creating or splitting a React component in apps/web (shared UI in src/components or feature UI in src/modules/<name>), or when the codestyle audit reports component file/naming violations.
---

# Create a standard web component

## Overview
A component is one PascalCase `.tsx` file, an arrow function with a named props interface,
exported as `export default memo(Component)` and re-exported from the folder's `index.ts` portal.
Full rules: `apps/web/.agents/rules/web-architecture.md`, `web-typescript.md`, `web-ui-forms.md`.

## Where it goes
| Kind | Location | Imported as |
|---|---|---|
| Shared, no feature knowledge | `src/components/<Name>/<Name>.tsx` + `index.ts` | `#components/<Name>` |
| Feature-specific | `src/modules/<feature>/<Name>.tsx` (add to module `index.ts`) | relative inside module, `#modules/<feature>` outside |
| Route-only JSX | inline in `src/routes/*.tsx` | — |

Shared components never import `#modules/*`; pass data in via props/children.

## Template
```tsx
import { memo } from 'react';

import { TmnCard, TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

export interface IProjectSummaryProps {
  name: string;
  repoCount: number;
  onOpen?: () => void;
}

const ProjectSummary = ({ name, repoCount, onOpen }: IProjectSummaryProps) => {
  if (!name) {
    return null;
  }

  return (
    <TmnCard header={{ title: name }} onClick={onOpen}>
      <TmnFlex direction="row" gap={2} className="min-w-0">
        <TmnText muted truncate>
          {trans('project.repo_count', { count: repoCount })}
        </TmnText>
      </TmnFlex>
    </TmnCard>
  );
};

export default memo(ProjectSummary);
```

Portal (`index.ts`, re-exports only):
```ts
export * from './ProjectSummary';
export { default as ProjectSummary } from './ProjectSummary';
```

## Checklist
- File name == component name; one component per file (render-prop callbacks are fine).
- Props: `I<Name>Props` interface, reuse/extend existing types instead of copying fields.
- UI from `@truyenmoinhu/uikit` first, then Tailwind theme tokens; icons from `lucide-react`, icon-only buttons get a label.
- Strings via `trans` with keys in both `src/i18n/locales/{vi,en}/translation.json`.
- Every `if` has braces; early returns before JSX; hooks never after a conditional return.
- Forms: `TmnForm` + `TmnController` per field (see `web-ui-forms.md`).
- Verify: `rtk pnpm --filter web audit:codestyle && rtk proxy pnpm --filter web typecheck && rtk pnpm --filter web exec biome check .`
