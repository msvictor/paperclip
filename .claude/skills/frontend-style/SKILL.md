---
name: frontend-style
description: >
  Code style, conventions, and patterns for React + TypeScript frontends.
  Read at the start of any frontend task. Covers TypeScript strictness,
  component patterns, TailwindCSS 4, shadcn/ui, and TanStack Router/Start/Query.
  Stack-aware: agent detects active technologies from package.json and applies
  only the relevant sections.
---
# Frontend Style Guide

## Activation

Start of every frontend task:

1. Read `package.json` (and `src/package.json` or `web/package.json` if monorepo) to identify active deps.
2. Map deps to sections:
   - `tailwindcss` → apply [tailwind.md](references/tailwind.md)
   - `@shadcn/ui` or `components/ui/` present → apply [shadcn.md](references/shadcn.md)
   - `@tanstack/react-router` or `@tanstack/react-start` → apply [tanstack.md](references/tanstack.md)
   - Always apply [typescript.md](references/typescript.md), [react-patterns.md](references/react-patterns.md), [file-structure.md](references/file-structure.md)
3. **voo-social-pro**: all sections apply. `src/` uses TanStack Start; `web/` uses TanStack Router legacy.

## Quick Reference

| Topic | File |
|---|---|
| TypeScript rules | [references/typescript.md](references/typescript.md) |
| React component patterns | [references/react-patterns.md](references/react-patterns.md) |
| TailwindCSS 4 | [references/tailwind.md](references/tailwind.md) |
| shadcn/ui usage | [references/shadcn.md](references/shadcn.md) |
| TanStack Router/Start/Query | [references/tanstack.md](references/tanstack.md) |
| File & folder structure | [references/file-structure.md](references/file-structure.md) |

## Core Principles

1. **Consistency over cleverness** — follow existing patterns before inventing new ones.
2. **Smallest diff** — add only what task requires; no adjacent refactors.
3. **Type safety first** — never suppress TypeScript errors; fix root causes.
4. **Co-location** — keep related files together (component + types + test same dir).
5. **No dead code** — no commented-out code, unused imports, or `TODO` without linked task.

## Reading Order for New Task

1. Read this file (done).
2. Read section files for detected stack.
3. Check `CONTRIBUTING.md` or `docs/` in repo — project overrides win.
4. Begin implementation.