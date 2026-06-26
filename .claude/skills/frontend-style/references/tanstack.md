# TanStack Router / Start / Query Patterns

## TanStack Router (legacy `web/` frontend)

### Route File Naming

| Pattern | Meaning |
|---|---|
| `routes/index.tsx` | Root `/` route |
| `routes/users.tsx` | `/users` segment |
| `routes/users/$userId.tsx` | `/users/:userId` dynamic segment |
| `routes/users_.$userId.edit.tsx` | `/users/:userId/edit` flat route (avoids nesting) |
| `routes/_layout.tsx` | Pathless layout wrapper |
| `routes/_layout/dashboard.tsx` | `/dashboard` inside the layout |

### Route Definition

Every route file must call `createFileRoute()` as the first exported value:

```tsx
// routes/users/$userId.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/users/$userId')({
  loader: ({ params }) => fetchUser(params.userId),
  component: UserPage,
});

function UserPage() {
  const user = Route.useLoaderData();
  return <div>{user.name}</div>;
}
```

### Loaders vs `beforeLoad`

- `loader`: fetch data needed to render the route. Runs in parallel for nested routes. Return value becomes `useLoaderData()`.
- `beforeLoad`: auth/permission guards and context setup. Throw `redirect()` to redirect.

```tsx
export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  loader: () => fetchDashboardData(),
  component: Dashboard,
});
```

### Search Params

Validate with Zod:

```tsx
import { z } from 'zod';

const searchSchema = z.object({
  page: z.number().int().positive().default(1),
  q: z.string().optional(),
});

export const Route = createFileRoute('/users')({
  validateSearch: searchSchema,
  component: UsersPage,
});

function UsersPage() {
  const { page, q } = Route.useSearch();
  ...
}
```

---

## TanStack Start (new `src/` frontend)

TanStack Start adds SSR and server functions on top of TanStack Router.

### Server Functions

Use `createServerFn` for data mutations or server-only logic:

```tsx
import { createServerFn } from '@tanstack/start';

export const updateUser = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string(), name: z.string() }))
  .handler(async ({ data }) => {
    return db.user.update({ where: { id: data.id }, data: { name: data.name } });
  });
```

Call server functions from components or loaders — they serialize automatically.

### Loaders with Server Functions

```tsx
export const Route = createFileRoute('/users/$userId')({
  loader: ({ params }) => getUser({ data: { id: params.userId } }),
  component: UserPage,
});
```

---

## TanStack Query

### `queryOptions()` Factory Pattern

Always define query options as factory functions in a dedicated file, not inline:

```ts
// src/queries/user.ts
import { queryOptions } from '@tanstack/react-query';

export function userQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['users', id],
    queryFn: () => fetchUser(id),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function usersQueryOptions(filters: UserFilters) {
  return queryOptions({
    queryKey: ['users', 'list', filters],
    queryFn: () => fetchUsers(filters),
  });
}
```

Consume in components:

```tsx
import { useQuery } from '@tanstack/react-query';
import { userQueryOptions } from '@/queries/user';

export function UserCard({ id }: { id: string }) {
  const { data: user } = useQuery(userQueryOptions(id));
  ...
}
```

### Mutations

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateUserInput) => updateUser(data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['users', id] });
    },
  });
}
```

### Prefetching in Loaders

Prefetch queries in route loaders to avoid waterfalls:

```tsx
export const Route = createFileRoute('/users')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(usersQueryOptions({})),
  component: UsersPage,
});
```

### Stale Times

| Data type | Stale time |
|---|---|
| User session / auth | `Infinity` — invalidate on mutation only |
| Reference / config data | 10–30 min |
| List views | 1–5 min |
| Detail views | 5 min |
| Real-time / notifications | 0 (always fresh) |
