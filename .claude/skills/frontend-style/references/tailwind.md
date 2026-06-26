# TailwindCSS 4 Conventions

## Configuration

TailwindCSS 4 uses a **CSS-first config** — no `tailwind.config.js`. Configuration lives in your main CSS file:

```css
/* src/styles/globals.css */
@import "tailwindcss";

@theme {
  --color-brand: oklch(55% 0.2 250);
  --color-brand-foreground: oklch(98% 0 0);
  --font-sans: "Inter", sans-serif;
  --radius-md: 0.5rem;
}
```

Access theme values in CSS via `--` variables; in class names via the normal utility API.

## Class Ordering

Apply classes in this order (matches Prettier Tailwind plugin sort):

1. Layout: `block`, `flex`, `grid`, `hidden`, `container`
2. Position: `relative`, `absolute`, `fixed`, `sticky`, `z-*`
3. Flex/Grid: `flex-col`, `items-center`, `justify-between`, `gap-*`, `col-span-*`
4. Spacing: `m-*`, `p-*`, `space-*`
5. Sizing: `w-*`, `h-*`, `min-*`, `max-*`
6. Colors: `bg-*`, `text-*`, `border-*`, `ring-*`
7. Typography: `text-sm`, `font-medium`, `leading-*`, `tracking-*`
8. Effects: `shadow-*`, `opacity-*`, `transition-*`, `animate-*`
9. Responsive/State modifiers: `sm:`, `md:`, `hover:`, `focus:`, `disabled:`

```tsx
// good — ordered
<div className="flex items-center gap-2 px-4 py-2 bg-white text-sm font-medium shadow-sm hover:bg-gray-50">

// bad — unordered (hard to scan)
<div className="text-sm hover:bg-gray-50 flex px-4 bg-white font-medium shadow-sm gap-2 items-center py-2">
```

## Conditional Classes

Always use the `cn()` utility from `lib/utils.ts` for conditional classes. Never concatenate strings.

```tsx
import { cn } from '@/lib/utils';

// good
<button className={cn(
  'px-4 py-2 rounded-md font-medium',
  isActive && 'bg-brand text-brand-foreground',
  isDisabled && 'opacity-50 cursor-not-allowed',
)}>

// bad — string concatenation
<button className={'px-4 py-2 ' + (isActive ? 'bg-brand' : '')}>
```

## Avoid `@apply`

Only use `@apply` in CSS for truly reusable base styles (e.g., button reset, focus ring). Prefer composing utilities directly in JSX.

```css
/* acceptable use of @apply */
@layer base {
  .focus-ring {
    @apply outline-none ring-2 ring-brand ring-offset-2;
  }
}
```

## Responsive Design

Mobile-first. Apply base styles for mobile, use breakpoint prefixes to expand for larger screens:

```tsx
// mobile-first
<div className="flex-col sm:flex-row gap-2 sm:gap-4 text-sm sm:text-base">
```

Breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px), `2xl` (1536px).

## Dark Mode

Use the `dark:` variant. Rely on `prefers-color-scheme` unless the project has a manual toggle. Define color pairs in `@theme`:

```css
@theme {
  --color-surface: oklch(98% 0 0);
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-surface: oklch(10% 0 0);
  }
}
```

## Design Tokens

Define all colors, radii, and font stacks as CSS custom properties in `@theme`. Reference them via the Tailwind utility API, not raw CSS variables in component files.

```tsx
// good — uses design token via utility
<div className="bg-brand text-brand-foreground">

// bad — bypasses token system
<div style={{ backgroundColor: 'var(--color-brand)' }}>
```

## Spacing Scale

Stick to the default Tailwind spacing scale (multiples of 4px). Add custom spacing only via `@theme` when the design requires it — not inline.
