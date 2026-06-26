# Principle 3 — Progressive Disclosure for Sub-Rules

## The Problem

If every rule goes into `AGENTS.md`, the file becomes too large to fit in context. If nothing is documented, agents invent conventions. Progressive disclosure solves this: root-level files stay lean, deeper context loads on demand.

## The Layers

```
AGENTS.md                        ← Layer 1: always loaded, ~200 lines max
docs/architecture.md             ← Layer 2: loaded when doing architecture work
.claude/skills/                  ← Layer 3: loaded per-task by Paperclip skill system
  frontend-style/                   styles, component patterns, TailwindCSS conventions
  ai-repo-standards/                this skill
  <feature>/                        feature-specific rules
docs/adr/                        ← Layer 4: loaded for specific decisions
  001-use-tanstack-query.md
```

## Rules for Each Layer

### Layer 1 — AGENTS.md
- Stack versions, architecture rules, CLI commands, pre-PR checklist
- Maximum 400 lines
- No deep explanations — link to Layer 2/3 for detail

### Layer 2 — docs/ files
- Architecture maps and system design
- ADRs (Architecture Decision Records) in `docs/adr/`
- Domain glossary in `docs/glossary.md`
- API contracts in `docs/api/`
- Agents load these explicitly when needed; they are not auto-loaded

### Layer 3 — .claude/skills/ (Paperclip skill system)
- Task-specific guides loaded per-run by Paperclip
- One skill per concern (frontend style, DB patterns, testing conventions)
- Each skill has a `SKILL.md` entrypoint + `references/` for detail
- Use the `reversa` skill to generate the Layer 3 context for a new project

### Layer 4 — ADRs
- One file per architectural decision
- Format: `docs/adr/NNN-short-title.md`
- Sections: Status, Context, Decision, Consequences
- Agents read these when making decisions that touch the same domain

## Creating Sub-Skills for a Project

When a project has conventions too detailed for AGENTS.md, create a project-local skill:

```bash
# In the project repo
mkdir -p .claude/skills/db-patterns/references
# Write .claude/skills/db-patterns/SKILL.md
# Import into Paperclip from the project workspace path
```

The `reversa` skill auto-generates an SDD that can seed this structure. Run it first on any new project before writing sub-skills manually.

## Cursor Rules (IDE-level)

For rules that apply to your own coding sessions (not agent runs), use `.cursor/rules/`:
- `.cursor/rules/typescript.mdc` — TypeScript conventions
- `.cursor/rules/testing.mdc` — test patterns

These are separate from Paperclip skills — they apply when you write code in Cursor, not when agents run.

## Audit Check

When auditing a repository:
- Is AGENTS.md under 400 lines? (too long → extract to docs/ or .claude/skills/)
- Are there undocumented conventions in the codebase? (→ create a sub-skill or ADR)
- Does the project have a `reversa` SDD? (missing → run the reversa skill)
- Are there Cursor rules for the main conventions? (optional but recommended)
