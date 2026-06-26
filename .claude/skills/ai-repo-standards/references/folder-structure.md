# Principle 1 — AI-First Folder Structure

## The Problem

An AI agent starts every session from scratch. The first thing it does is read the directory tree. If project context is buried deep in nested folders or mixed with generated artifacts, the agent wastes tokens discovering it.

## Required Top-Level Layout

```
project-root/
  docs/           # Architecture maps, business reasoning, feature design goals
  ops/            # Dockerfiles, CI configs, deployment scripts, infra code
  src/            # Operational codebase logic only
  AGENTS.md       # AI system prompt (see agents-md.md)
  README.md       # Human-facing overview
  .env.example    # Env var template (never .env with real values)
```

## Rules

**`docs/`**
- Architecture decision records (ADRs)
- System design documents
- Domain glossary
- Feature specs and business reasoning
- Do NOT put generated output here (Reversa SDD goes in `docs/reversa/` or the Obsidian vault)

**`ops/`**
- `Dockerfile`, `docker-compose*.yml`
- CI/CD pipeline definitions (`.github/workflows/`, etc.)
- Infrastructure-as-code (Terraform, Pulumi, etc.)
- Deployment and migration scripts
- Do NOT put application logic here

**`src/`**
- All runtime application code
- No config files, no docs, no scripts
- Subdirectory structure is framework-dependent (see `frontend-style` skill for React/TS conventions)

## Anti-Patterns to Flag

| Anti-pattern | Action |
|---|---|
| Architecture docs in `src/` comments | Move to `docs/` |
| Dockerfiles in project root with no `ops/` | Create `ops/` and move them |
| Generated HTML/PDF in repo root | Add to `.gitignore`, delete |
| Config files scattered at root (>5) | Consolidate into `ops/` or `config/` |
| `scripts/` at root with >10 files, no docs | Add `scripts/README.md` or move to `ops/` |

## Monorepo Variant

For monorepos, each package follows the same layout internally. Add a top-level `packages/` or `apps/` directory. The root `docs/` covers cross-package architecture; each package may have its own `docs/` for package-specific detail.

```
monorepo-root/
  docs/           # Cross-package architecture
  ops/            # Shared infra
  packages/
    api/
      docs/       # API-specific docs
      src/
    web/
      docs/
      src/
  AGENTS.md
```
