# TypeScript Conventions

## Compiler Settings

Always use `strict: true`. Never disable `noImplicitAny`, `strictNullChecks`, or `strictFunctionTypes`.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## Naming

| Construct | Convention | Example |
|---|---|---|
| Types / Interfaces | PascalCase | `UserProfile`, `ApiResponse` |
| Enums | PascalCase + SCREAMING_SNAKE values | `Status.IN_PROGRESS` |
| Variables / functions | camelCase | `fetchUser`, `isLoading` |
| Constants (module-level) | SCREAMING_SNAKE | `MAX_RETRIES` |
| Files | kebab-case | `user-profile.tsx` |
| React components | PascalCase filename | `UserCard.tsx` |

## Types vs Interfaces

- `interface` for object shapes that may be extended or implemented.
- `type` for unions, intersections, mapped types, and primitives.

```ts
// object shape → interface
interface UserProps {
  id: string;
  name: string;
}

// union → type
type Status = 'idle' | 'loading' | 'error' | 'success';
```

## Banning `any`

Never use `any`. Use `unknown` and narrow explicitly:

```ts
// bad
function parse(input: any) { ... }

// good
function parse(input: unknown): string {
  if (typeof input !== 'string') throw new TypeError('Expected string');
  return input;
}
```

Use `satisfies` when you need type-checking without widening:

```ts
const config = {
  timeout: 5000,
  retries: 3,
} satisfies Partial<RequestConfig>;
```

## Return Types

Exported functions must have explicit return types. Internal helpers may rely on inference when the type is obvious.

```ts
// required on exports
export function formatDate(date: Date): string { ... }
export async function fetchUser(id: string): Promise<User> { ... }
```

## Nullability

Prefer `undefined` over `null` for optional values. Use `null` only when it is part of an external API contract.

```ts
interface UserQuery {
  cursor?: string;        // optional — use undefined
  deletedAt: string | null; // external DB value — null is correct
}
```

## Runtime Validation with Zod

Use Zod for all external data boundaries (API responses, form inputs, URL params).

```ts
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

type User = z.infer<typeof UserSchema>;
```

## Generics

Name type parameters descriptively unless the meaning is obvious from context:

```ts
// obvious context — T is fine
function identity<T>(value: T): T { return value; }

// multiple params — name them
function mapResponse<TInput, TOutput>(
  data: TInput,
  transform: (input: TInput) => TOutput
): TOutput { ... }
```

## Imports

Use named imports. Avoid namespace imports (`import * as`) unless working with a library that has no named exports.

```ts
// good
import { useState, useEffect } from 'react';

// avoid
import * as React from 'react';
```

Sort order (enforced by ESLint `import/order` if configured):
1. Node built-ins
2. External packages
3. Internal aliases (`@/...`)
4. Relative imports

Separate each group with a blank line.
