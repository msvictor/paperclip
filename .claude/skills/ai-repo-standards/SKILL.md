---
name: ai-repo-standards
description: >
  AI-readability and AI-friendliness standards for any code repository.
  Read at the start of any project setup, repo audit, or refactor task.
  Covers folder structure, AGENTS.md, sub-rules, testing loops, git hygiene,
  and RAG-readiness. Tells agents what to check, create, and enforce.
---
# AI Repo Standards

## Activation

Read at start of any task involving:
- New repo/project setup
- Existing repo AI-readiness audit
- Project structure refactor
- Onboarding project into Paperclip for agent work

Run 6-principle checklist against project. Each principle: record state (pass / partial / missing), describe gap, estimate effort (S/M/L), list files/dirs to create or change. Post findings as task comment before proceeding.

## The 6 Principles

| # | Principle | Reference |
|---|---|---|
| 1 | AI-First Folder Structure | [references/folder-structure.md](references/folder-structure.md) |
| 2 | AGENTS.md at the Root | [references/agents-md.md](references/agents-md.md) |
| 3 | Progressive Disclosure for Sub-Rules | [references/progressive-disclosure.md](references/progressive-disclosure.md) |
| 4 | Testing Safety Net | [references/testing-safety-net.md](references/testing-safety-net.md) |
| 5 | Strict Git Cleanliness | [references/git-cleanliness.md](references/git-cleanliness.md) |
| 6 | RAG-Readiness | [references/rag-readiness.md](references/rag-readiness.md) |

## Audit Output Format

Each principle:

```
## Principle N — <Name>
Status: pass | partial | missing
Gap: <one sentence>
Effort: S | M | L
Actions:
- [ ] <specific file or directory to create/change>
```

## When Violations Are Found

- **Missing artifacts** (no AGENTS.md, no docs/ folder): create as part of task.
- **Git cleanliness violations** (binaries committed, secrets in .env): flag blocker, don't proceed until resolved.
- **Structural violations** (wrong folder layout): propose in task comment, wait for approval before restructuring.
- **Missing tests**: flag high-priority subtask, don't block current work unless CI fully absent.

## Project-Specific Overrides

If project has `CONTRIBUTING.md` or `.claude/skills/` with local rules, those override this skill. Read them first.