# shadcn/ui Conventions

## What shadcn/ui Is

shadcn/ui copies component source into your repo (`components/ui/`). You own the code. The CLI (`bunx shadcn add <component>`) generates the file; after that it is your file.

## Directory Layout

```
src/components/
  ui/              # generated shadcn components — treat as base layer
    button.tsx
    input.tsx
    dialog.tsx
    ...
  common/          # project-wide shared components built on top of ui/
    PageHeader.tsx
    DataTable.tsx
  <feature>/       # feature-specific components
    user-card/
      UserCard.tsx
```

## Never Edit `components/ui/` Directly

If the upstream shadcn component changes, you'll lose your edits on re-run. Instead:

1. **Wrap** — create a new component in `components/common/` or a feature directory that imports from `ui/` and adds your logic.
2. **Extend via `className`** — pass additional classes through the `className` prop.
3. **Compose** — build compound components from multiple `ui/` primitives.

```tsx
// bad — editing ui/button.tsx
export function Button({ ... }) {
  // adding project-specific logic here
}

// good — wrap it
// components/common/PrimaryButton.tsx
import { Button } from '@/components/ui/button';

export function PrimaryButton({ children, ...props }: ButtonProps) {
  return (
    <Button variant="default" className="font-semibold tracking-wide" {...props}>
      {children}
    </Button>
  );
}
```

## Using `cn()` for Overrides

All shadcn components accept a `className` prop. Merge it with `cn()`:

```tsx
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export function FeatureCard({ className, ...props }: CardProps) {
  return (
    <Card
      className={cn('border-brand/20 hover:shadow-md transition-shadow', className)}
      {...props}
    />
  );
}
```

## Installing New Components

```bash
bunx shadcn add <component-name>
```

This generates the file in `components/ui/`. Commit the generated file as-is, then wrap if you need customization.

## Variants

Use the `variant` and `size` props built into each component before reaching for `className` overrides. Only override with `className` when no built-in variant covers the need.

```tsx
// prefer built-in variants
<Button variant="ghost" size="sm">Cancel</Button>

// className override only when necessary
<Button variant="outline" className="border-dashed">Import</Button>
```

## Form Components

Always pair shadcn form inputs with React Hook Form and Zod:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const schema = z.object({ email: z.string().email() });

export function LoginForm({ onSubmit }: { onSubmit: (data: z.infer<typeof schema>) => void }) {
  const form = useForm({ resolver: zodResolver(schema) });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <Input {...field} />
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
```

## Dialog / Sheet Pattern

Always control open state externally. Never put `useState` for dialog open state inside the dialog component itself.

```tsx
// parent controls open state
const [open, setOpen] = useState(false);

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>...</DialogContent>
</Dialog>
```

## Theme

shadcn/ui 2.x uses CSS variables in `globals.css`. Do not override `--background`, `--foreground`, `--primary`, etc. inline — adjust them in the CSS theme block.
