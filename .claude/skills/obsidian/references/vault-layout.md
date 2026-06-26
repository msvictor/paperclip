# Vault Layout Reference

Full reference for every folder in the obsidian vault.

**Container path:** `/obsidian/`
**macOS path:** `~/Documents/obsidian/`

---

## `/obsidian/paperclip-brain/00-dashboard/`

**Owner:** Agents write; operator reads.

Contains auto-generated status pages. The primary file is `status.md`.

| File | Purpose |
|------|---------|
| `status.md` | Current Paperclip issue status, agent assignments, recent completions |

Agents regenerate this on request by querying the Paperclip API. The operator reads
it in Obsidian to get a quick view of what is in flight without opening the board.

**Naming:** Only `status.md` currently. Future: `status-<YYYY-MM-DD>.md` archives.

---

## `/obsidian/paperclip-brain/01-specs/`

**Owner:** Operator writes; agents read.

Holds project specifications and requirements authored by the operator. Agents
read these before starting a task to understand what is expected of them.

| File | Purpose |
|------|---------|
| `_template.md` | Starting template for new specs |
| `ai-repo-standards.md` | AI-readability standards reference for all projects |
| `<slug>.md` | One file per spec topic |

**Naming:** lowercase kebab-case, e.g. `auth-refresh-flow.md`, `queue-jobs-v2.md`.

**Agent behavior:** Before starting a task, scan this folder for specs that mention
the current project or feature area. If a spec's acceptance criteria directly cover
the task, treat those criteria as the definition of done.

**Frontmatter required:**
```yaml
---
date: YYYY-MM-DD
project: project-name
type: spec
status: draft | ready | superseded
---
```

---

## `/obsidian/paperclip-brain/02-projects/`

**Owner:** Both operator and agents write; both read.

One subfolder per project. Each subfolder contains a `README.md` with tech stack,
repository info, active agents, and key directory layout.

```
02-projects/
└── voo-social-pro/
    ├── README.md
    ├── ux-roadmap.md
    └── ai-standards-roadmap.md
```

**Adding a new project:** Create `02-projects/<project-slug>/README.md` following
the `voo-social-pro/README.md` structure.

**Agent behavior:** Read `02-projects/<project>/README.md` at the start of every
task for that project to orient quickly without reading the codebase.

---

## `/obsidian/paperclip-brain/03-reversa/`

**Owner:** Agents write; operator reads.

Holds Reversa-generated specs copied from `_reversa_sdd/` after an analysis run.
Organized by project name.

```
03-reversa/
└── voo-social-pro/
    ├── overview.spec.md
    ├── auth/
    │   ├── entities.spec.md
    │   ├── contracts.spec.md
    │   └── rules.spec.md
    └── ...
```

**Agent behavior:** After running `/reversa` in a project workspace, copy the
full `_reversa_sdd/` directory to `/obsidian/paperclip-brain/03-reversa/<project-name>/`. Before
starting implementation work on a module, check here first — reading a
`contracts.spec.md` is far cheaper than re-analyzing source code.

**Confidence markers in spec files:**
- `CONFIRMED` — directly evidenced by source code; trust fully
- `INFERRED` — plausible from context; verify if the feature is critical
- `GAP` — missing information; surface as a blocker if relevant to the task

---

## `/obsidian/paperclip-brain/04-agent-notes/`

**Owner:** Agents write; operator reads.

One subfolder per agent. Each note documents work done during a task session.

```
04-agent-notes/
├── _conventions.md          ← read this before writing any note
├── TecLidio/
│   └── 2026-06-23-CER-18-auth-analysis.md
├── Especialisto/
│   └── 2026-06-24-CER-22-queue-impl.md
└── Junin Pleno/
    └── ...
```

**File naming:** `<YYYY-MM-DD>-<task-id>-<slug>.md`

**Required frontmatter:**
```yaml
---
date: YYYY-MM-DD
agent: AgentName
project: project-name
task-id: CER-XX
type: progress | reversa | dashboard | analysis
status: in-progress | done | blocked
---
```

**Note types:**
- `progress` — milestone update during or after a task
- `reversa` — summary note written after a Reversa analysis run
- `dashboard` — written when generating the dashboard (rarely needed as a note)
- `analysis` — deep-dive analysis notes (architecture decisions, trade-off evaluations)

**Conventions:** Read `/obsidian/paperclip-brain/04-agent-notes/_conventions.md` for the full
note body structure by type.

---

## Root files

| File | Purpose |
|------|---------|
| `README.md` | Vault orientation — folder guide, how-to for operator and agents |

---

## What does NOT belong in the vault

- Raw source code (link to GitHub or reference a file path instead)
- Secrets, API keys, tokens, credentials of any kind
- Binary files, images, or media
- Temporary scratch files (use the agent workspace for those)
- Files outside the four numbered folders (except root `README.md`)
