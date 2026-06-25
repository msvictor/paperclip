---
name: reversa
description: >
  Reverse-engineer any existing codebase into traceable, executable specifications for AI agents.
  Use whenever you are assigned to a project with undocumented or partially documented code, before
  implementing features across a module you haven't analyzed, when existing specs in the repository
  are absent or stale, or when you need to produce a migration or modernization plan.
  Do NOT use for greenfield projects with no existing code to analyze — use /reversa-new instead.
---
# Reversa

Reversa coordinates specialized AI sub-agents to analyze legacy codebase and produce complete, traceable specs. Output lives in `_reversa_sdd/`. Safe to attach as Paperclip artifact. **Reversa never modifies original source files** — writes only to `.reversa/` (state and config) and `_reversa_sdd/` (generated specs).

For full command reference, load `references/commands.md`.

---

## When to use

- Assigned to project, no spec or spec stale vs code
- Need to understand module before implementing feature
- Task: document, migrate, or estimate effort on existing system
- Onboarding onto new project workspace first time

## When NOT to use

- Greenfield project (no existing code) — use `/reversa-new` instead
- Already have up-to-date specs, adding small well-understood feature
- Task is hotfix or cosmetic change in readable code

---

## Step 1 — Install (once per project)

Run from **project root** inside workspace:

```bash
npx reversa install
```

Installer detects Claude Code automatically and:
1. Copies Reversa agent skills into `.claude/skills/` and `.agents/skills/`
2. Creates `.reversa/` (state, config, plan) and `_reversa_sdd/` (output target)
3. Generates SHA-256 manifest — safe to re-run; never overwrites customizations

Unsure if already installed, check:

```bash
npx reversa status
```

No active analysis → installation needed. Partial analysis → skip to Step 2 to resume.

---

## Step 2 — Activate and run the analysis

Inside project, type:

```
/reversa
```

Reversa introduces itself, builds exploration plan, asks confirmation, then runs five-phase pipeline:

1. **Reconnaissance** — Scout maps repo structure, identifies modules
2. **Excavation** — Specialist agents read source files in depth
3. **Interpretation** — Business rules, contracts, architectural decisions extracted
4. **Generation** — Structured `.spec.md` files written to `_reversa_sdd/`
5. **Review** — Confidence markers (CONFIRMED, INFERRED, GAP) applied and cross-checked

Progress saved at each checkpoint in `.reversa/state.json`. Session interrupted → type `/reversa` to resume exactly where stopped.

---

## Step 3 — Use the generated specs

After analysis, `_reversa_sdd/` contains spec files organized by module. Reference in subsequent tasks instead of re-reading raw source. Agents reading spec consume far fewer tokens than re-analyzing source per task.

Confidence markers indicate reliability:
- `CONFIRMED` — directly supported by source code
- `INFERRED` — plausible but not explicitly stated in code
- `GAP` — missing info needing human or agent validation

---

## Step 4 — Upload specs as a Paperclip artifact

After generating specs, attach to current issue so other agents can access:

```bash
# Compress the spec directory
tar -czf _reversa_sdd.tar.gz _reversa_sdd/

# Upload using the Paperclip artifact helper
bash /app/skills/paperclip/scripts/paperclip-upload-artifact.sh \
  --file _reversa_sdd.tar.gz \
  --name "reversa-specs-$(basename $PWD)" \
  --issue-id "$PAPERCLIP_TASK_ID"
```

Post comment on issue with artifact link and set status to done.

---

## Available commands

| Goal | Command |
|------|---------|
| Analyze existing codebase into specs | `/reversa` |
| Start new project from one-line idea | `/reversa-new` |
| Evolve system one feature at a time | `/reversa-forward` |
| Rebuild legacy on modern stack | `/reversa-migrate` |
| Render specs as HTML mini-site | `/reversa-docs` |
| Estimate effort and pricing from specs | `/reversa-pricing-estimate` |

For detailed descriptions and options, load `references/commands.md`.

---

## CLI management commands

Run from project root anytime:

```bash
npx reversa status       # Show current analysis state and phase progress
npx reversa update       # Update Reversa agents to the latest version (SHA-256 safe)
npx reversa add-agent    # Add a specific agent team to an existing installation
npx reversa add-engine   # Add support for a new AI engine
npx reversa uninstall    # Remove Reversa (only removes files it created; never touches source)
```

---

## Safety guarantees

- Reversa writes **only** to `.reversa/` and `_reversa_sdd/`
- No original project file ever modified, deleted, or overwritten
- No API keys requested, stored, or transmitted — uses whichever agent active in environment (Claude Code in this setup)
- `npx reversa update` uses SHA-256 checksums, skips any customized file