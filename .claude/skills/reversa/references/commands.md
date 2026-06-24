# Reversa Command Reference

Full reference for all Reversa slash commands and CLI management utilities.

---

## Slash Commands (used inside the agent session)

### `/reversa` — Analyze existing codebase

**Use when:** The project has existing code that you need to understand and document.

Runs the full five-phase pipeline:

| Phase | Name | What happens |
|-------|------|--------------|
| 1 | Reconnaissance | Scout agent maps repository structure, identifies modules, languages, and entry points |
| 2 | Excavation | Specialist agents read source files in depth — controllers, models, services, configs |
| 3 | Interpretation | Business rules, data contracts, and architectural decisions are extracted and classified |
| 4 | Generation | Structured `.spec.md` files are written to `_reversa_sdd/` organized by module |
| 5 | Review | Confidence markers applied; gaps and contradictions surfaced |

**Resumable:** Progress is saved at each checkpoint in `.reversa/state.json`. If interrupted,
type `/reversa` again to resume from the last completed phase.

**Output:** `_reversa_sdd/` directory containing spec files. Each spec section is tagged:
- `CONFIRMED` — directly evidenced by source code
- `INFERRED` — plausible from context but not explicitly stated
- `GAP` — missing information requiring human or agent validation

---

### `/reversa-new` — Start a new project from a one-line idea

**Use when:** You are building a greenfield project (no existing code). Provide a brief
description of the product and Reversa generates an initial SDD (Software Design Document) to
guide development from scratch.

---

### `/reversa-forward` — Evolve the system one feature at a time

**Use when:** You have an existing set of Reversa specs (`_reversa_sdd/`) and want to implement
a new feature. Reversa reads the current spec, identifies the impact zone, generates a
feature-specific design sub-document, then guides implementation.

**Prerequisite:** `/reversa` must have been run first (or specs must exist in `_reversa_sdd/`).

---

### `/reversa-migrate` — Rebuild legacy on a modern stack

**Use when:** The goal is to migrate the existing system to a different stack (e.g., REST → GraphQL,
Express → NestJS, MySQL → PostgreSQL). Reversa analyzes the current implementation, extracts the
behavioral contracts, and produces a step-by-step migration plan.

**Output:** A migration SDD in `_reversa_sdd/migration/` covering:
- Mapping of current entities and endpoints to the target stack
- Data migration strategy
- Parallel-run and cutover plan
- Rollback checkpoints

---

### `/reversa-docs` — Render specs as an HTML mini-site

**Use when:** You want a human-readable view of the generated specs for sharing with
stakeholders or for review. Renders all `.spec.md` files in `_reversa_sdd/` into a navigable
static HTML site.

**Output:** `_reversa_sdd/docs/index.html` plus linked pages.

---

### `/reversa-pricing-profile` — Profile the system complexity

**Use when:** You need to characterize the system (size, complexity, component count) before
producing an effort estimate. Run this before `/reversa-pricing-size` and
`/reversa-pricing-estimate`.

---

### `/reversa-pricing-size` — Size the effort

**Use when:** You have a complexity profile and want to break the work into sized units
(story points, T-shirt sizes, or hours). Requires `/reversa-pricing-profile` to have run first.

---

### `/reversa-pricing-estimate` — Produce a cost/effort estimate

**Use when:** You have both a complexity profile and a sizing breakdown and want a final
dollar or time estimate. Aggregates the profile and size outputs into a deliverable estimate doc.

**Output:** Estimate document in `_reversa_sdd/pricing/`.

---

## CLI Management Commands

Run from the **project root**. These manage the Reversa installation itself, not the analysis.

```bash
npx reversa install      # Install Reversa in the current project
                         # Safe to re-run — SHA-256 manifest skips customized files

npx reversa status       # Show current analysis state
                         # Reports active phase, completed phases, and output file count

npx reversa update       # Update Reversa agent files to the latest npm version
                         # Never overwrites files you have manually customized (SHA-256 check)

npx reversa add-agent    # Interactive: add a specific agent team to an existing installation
                         # Teams: Core (always), Migration, CodeForward, Pricing, Translators

npx reversa add-engine   # Add support for an additional AI engine
                         # Useful if you add Codex or Gemini CLI alongside Claude Code

npx reversa uninstall    # Remove Reversa from the project
                         # Only removes files created by Reversa — source code is never touched
```

---

## Output directory layout

```
_reversa_sdd/
├── overview.spec.md          # System summary, tech stack, key architectural decisions
├── <module>/
│   ├── entities.spec.md      # Data models and relationships
│   ├── contracts.spec.md     # API endpoints, queue messages, events
│   └── rules.spec.md         # Business logic and validation rules
├── migration/                # Present if /reversa-migrate was run
│   ├── plan.spec.md
│   └── cutover.spec.md
├── pricing/                  # Present if /reversa-pricing-* was run
│   └── estimate.spec.md
└── docs/                     # Present if /reversa-docs was run
    └── index.html

.reversa/
├── state.json                # Current phase progress (used for resume)
├── config.json               # Project name, language, preferences
└── plan.md                   # Auto-generated exploration plan
```

---

## Requirements

- **Node.js 18+** — already present in the Paperclip Docker container
- **No additional API keys** — Reversa uses the active Claude Code session; no external services
- **Git repository** — the project root should be a git repo (standard for all Paperclip workspaces)
