# File & Folder Structure

## TanStack Start Frontend (`src/`)

```
src/
  routes/                   # TanStack Start file-based routes
    __root.tsx              # Root layout, QueryClientProvider, RouterDevtools
    index.tsx               # / home route
    _auth.tsx               # Pathless layout for authenticated routes
    _auth/
      dashboard.tsx
      users/
        index.tsx           # /users list
        $userId.tsx         # /users/:userId detail
  components/
    ui/                     # shadcn-generated primitives (do not edit)
    common/                 # project-wide shared components
    <feature>/              # feature-scoped components
      <ComponentName>/
        ComponentName.tsx
        ComponentName.test.tsx
        index.ts
  hooks/                    # project-wide custom hooks
    useCurrentUser.ts
    useDebounce.ts
  queries/                  # TanStack Query option factories
    user.ts
    posts.ts
  lib/
    utils.ts                # cn(), formatDate(), etc.
    api.ts                  # fetch wrapper / API client
    constants.ts
  types/
    api.ts                  # API response types (or generated from Zod schemas)
    index.ts                # shared domain types
  styles/
    globals.css             # Tailwind @import + @theme tokens
```

## Legacy Vite Frontend (`web/`)

Same structure as above but using TanStack Router (file-based) instead of Start:

```
web/src/
  routes/
  components/
  hooks/
  queries/
  lib/
  types/
  styles/
```

## Naming Rules

| Item | Convention | Example |
|---|---|---|
| Route files | kebab-case | `user-settings.tsx` |
| Component files | PascalCase | `UserCard.tsx` |
| Hook files | camelCase prefixed `use` | `useCurrentUser.ts` |
| Query files | camelCase noun | `user.ts`, `posts.ts` |
| Utility files | kebab-case | `format-date.ts` |
| Type files | kebab-case | `api-types.ts` |
| Test files | same name + `.test.tsx` | `UserCard.test.tsx` |
| Storybook files | same name + `.stories.tsx` | `UserCard.stories.tsx` |

## Barrel Exports

Use `index.ts` barrels only at the component directory level — not for entire features or top-level folders. Deep barrels (`src/index.ts`) cause circular dependency issues.

```ts
// components/common/UserCard/index.ts
export { UserCard } from './UserCard';
export type { UserCardProps } from './UserCard';
```

## Test Colocation

Unit tests live next to the file they test. Integration and E2E tests live in a top-level `tests/` or `e2e/` directory.

```
components/UserCard/
  UserCard.tsx
  UserCard.test.tsx     ← unit test (Vitest + Testing Library)

e2e/
  user-profile.spec.ts  ← E2E (Playwright)
```

## Asset Handling

Static assets that do not need Vite processing: `public/`
Imported assets (images, SVGs used as components): `src/assets/`

```tsx
// imported asset
import logo from '@/assets/logo.svg';

// public asset (referenced by URL)
<img src="/og-image.png" alt="..." />
```

## Path Aliases

Always use the `@/` alias instead of relative paths when crossing more than one directory level.

```ts
// good
import { cn } from '@/lib/utils';
import { UserCard } from '@/components/common/UserCard';

// bad (crossing multiple levels)
import { cn } from '../../../lib/utils';
```

Configure in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```
