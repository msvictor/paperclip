# Principle 2 — AGENTS.md at the Root

## Purpose

`AGENTS.md` is the system prompt for any AI agent working in this repository. It must be sparse, direct, and explicit. Agents read it at the start of every session. Every sentence costs tokens.

## Required Sections

### 1. Stack

Exact versions. No approximations.

```markdown
## Stack
- Runtime: Node.js 22.x
- Framework: NestJS 10.x + Prisma 5.x
- Frontend: React 19 + TanStack Start + TailwindCSS 4
- DB: PostgreSQL 16 + Redis 7
- Package manager: Bun 1.x
- Container: Docker Compose (ops/docker-compose.dev.yml)
```

### 2. Architecture Rules

Canonical paradigms the agent must not violate. Three to ten rules max.

```markdown
## Architecture Rules
1. All domain entities are company-scoped.
2. Server state lives in TanStack Query — never duplicate in useState.
3. No default exports from component files.
4. Secrets live in environment variables only — never hardcoded.
5. Every mutation writes an activity log entry.
```

### 3. CLI Commands

Exact strings. Agents copy-paste these — do not paraphrase.

```markdown
## CLI Commands
- Install: `bun install`
- Dev server: `bun dev`
- Tests: `bun test` (must complete in <30s)
- Typecheck: `bun run typecheck`
- Build: `bun run build`
- DB migrate: `bun run db:migrate`
- Lint: `bun run lint`
```

### 4. Pre-PR Checklist

What the agent must verify before opening a pull request.

```markdown
## Pre-PR Checklist
- [ ] `bun run typecheck` passes with zero errors
- [ ] `bun test` passes
- [ ] No `.env` changes (only `.env.example`)
- [ ] No binary files added to git
- [ ] Activity log entries written for all mutations
```

## Rules for Writing AGENTS.md

1. **Keep it under 400 lines.** Use `progressive-disclosure.md` (Principle 3) for deeper detail.
2. **No prose.** Use lists and tables. Every word must earn its place.
3. **Concrete over abstract.** "Run `bun test`" not "run the tests".
4. **No tutorials.** Assume the agent knows the frameworks. Only state what is non-standard.
5. **Update it when architecture changes.** A stale AGENTS.md is worse than none.

## Template

Copy this template when creating a new project's AGENTS.md:

```markdown
# AGENTS.md

## Stack
<!-- exact versions here -->

## Architecture Rules
<!-- 3-10 non-negotiable rules -->

## CLI Commands
- Install: ``
- Dev: ``
- Test: ``
- Typecheck: ``
- Build: ``

## Pre-PR Checklist
- [ ] Typecheck passes
- [ ] Tests pass
- [ ] No secrets in committed files
- [ ] No binary files added
```

## Audit Check

When auditing a repository:
- Does `AGENTS.md` exist at the root? (missing → create from template)
- Does it have all 4 required sections? (partial → add missing sections)
- Is it under 400 lines? (too long → move detail to `docs/` or sub-skill files)
- Is the stack section accurate? (stale → update versions)
