# React Patterns

## Component Definition

Always use arrow functions with named exports. Never use `React.FC` or `export default` for components.

```tsx
// good
interface UserCardProps {
  user: User;
  onSelect: (id: string) => void;
}

export function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <div onClick={() => onSelect(user.id)}>
      {user.name}
    </div>
  );
}

// bad — default export makes tree-shaking and refactoring harder
export default function UserCard() { ... }

// bad — React.FC adds implicit children and hides return type issues
const UserCard: React.FC<UserCardProps> = ({ user }) => { ... }
```

## Props Typing

Always define props as an `interface` directly above the component. Never use inline types.

```tsx
interface ButtonProps {
  label: string;
  variant?: 'primary' | 'ghost' | 'destructive';
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({ label, variant = 'primary', disabled, onClick }: ButtonProps) { ... }
```

For components that forward HTML element props, extend the native type:

```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}
```

## File Colocation

One component per file. Co-locate the component with its direct dependencies:

```
components/
  user-card/
    UserCard.tsx        # component
    UserCard.test.tsx   # unit test
    user-card.types.ts  # types used only by this component
    index.ts            # re-export: export { UserCard } from './UserCard'
```

Barrel `index.ts` is only required when the component is consumed from outside its directory.

## Single Responsibility

Components should do one thing. Split when a component:
- exceeds ~150 lines
- renders more than two conceptually separate sections
- manages more than two independent pieces of state

Extract sub-components into the same directory.

## Hooks

- Prefix all custom hooks with `use`.
- Place project-wide hooks in `src/hooks/`.
- Place hooks used by a single component in the same directory as the component.
- Hooks must not produce side effects in their body (only inside `useEffect`).

```ts
// src/hooks/useCurrentUser.ts
export function useCurrentUser() {
  const query = useQuery(currentUserQueryOptions());
  return {
    user: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
```

## State Management

Prefer local state (`useState`) for UI-only state. Lift state up only when two sibling components need the same value. Use TanStack Query for server state — do not duplicate server data in `useState`.

```tsx
// bad — duplicating server state into local state
const [user, setUser] = useState<User | null>(null);
useEffect(() => { fetchUser().then(setUser); }, []);

// good — server state lives in the query cache
const { data: user } = useQuery(userQueryOptions(id));
```

## Event Handlers

Name event handlers `handleX` for component-internal handlers, `onX` for props passed to children.

```tsx
// internal handler
function handleSubmit(e: React.FormEvent) { ... }

// prop name
interface FormProps {
  onSubmit: (data: FormData) => void;
}
```

## Conditional Rendering

Use ternary for simple two-branch conditions. Use early returns or dedicated sub-components for complex branching. Avoid nested ternaries.

```tsx
// good — simple two-branch
{isLoading ? <Spinner /> : <Content />}

// good — early return for error boundary
if (error) return <ErrorState error={error} />;
if (!data) return <EmptyState />;
return <DataView data={data} />;

// bad — nested ternary
{isLoading ? <Spinner /> : error ? <Error /> : <Content />}
```

## Keys in Lists

Always use stable, unique keys. Never use array indices.

```tsx
// bad
{items.map((item, i) => <Item key={i} {...item} />)}

// good
{items.map((item) => <Item key={item.id} {...item} />)}
```

## Avoiding Over-Rendering

- Wrap callbacks passed as props in `useCallback` when the parent re-renders frequently.
- Wrap expensive computations in `useMemo`.
- Do not memoize every component by default — only when profiling confirms a bottleneck.
