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

Reversa coordinates a team of specialized AI sub-agents to analyze a legacy codebase and produce
complete, traceable specifications. The output lives in `_reversa_sdd/` and is safe to attach as
a Paperclip artifact. **Reversa never modifies your original source files** — it writes only to
`.reversa/` (state and config) and `_reversa_sdd/` (generated specs).

For the full command reference, load `references/commands.md`.

---

## When to use

- You are assigned to a project and have no spec, or the spec is stale relative to the code
- You need to understand a module before safely implementing a feature
- The task is to document, migrate, or estimate effort on an existing system
- You are onboarding onto a new project workspace for the first time

## When NOT to use

- The project is a greenfield (no existing code) — use `/reversa-new` instead
- You already have up-to-date specs and are only adding a small, well-understood feature
- The task is a hotfix or cosmetic change in code you can read directly

---

## Step 1 — Install (once per project)

Run from the **project root** inside your workspace:

```bash
npx reversa install
```

The installer detects Claude Code automatically and:
1. Copies Reversa agent skills into `.claude/skills/` and `.agents/skills/` of the project
2. Creates `.reversa/` (state, config, plan) and `_reversa_sdd/` (output target)
3. Generates a SHA-256 manifest — safe to re-run; it never overwrites your customizations

If you are unsure whether Reversa is already installed, check:

```bash
npx reversa status
```

If it reports no active analysis, installation is needed. If it shows a partial analysis, skip
to Step 2 to resume.

---

## Step 2 — Activate and run the analysis

Inside the project, type the slash command:

```
/reversa
```

Reversa introduces itself, builds a personalized exploration plan, asks for your confirmation,
then runs the five-phase pipeline:

1. **Reconnaissance** — Scout maps the repo structure and identifies modules
2. **Excavation** — Specialist agents read source files in depth
3. **Interpretation** — Business rules, contracts, and architectural decisions are extracted
4. **Generation** — Structured `.spec.md` files are written to `_reversa_sdd/`
5. **Review** — Confidence markers (CONFIRMED, INFERRED, GAP) are applied and cross-checked

Progress is saved at each checkpoint in `.reversa/state.json`. If the session is interrupted,
type `/reversa` again to resume exactly where it stopped.

---

## Step 3 — Use the generated specs

After the analysis completes, `_reversa_sdd/` contains spec files organized by module. Reference
them in subsequent tasks instead of re-reading raw source. Agents reading a spec consume far
fewer tokens than re-analyzing source on every task.

Confidence markers tell you how reliable each spec section is:
- `CONFIRMED` — directly supported by source code
- `INFERRED` — plausible but not explicitly stated in code
- `GAP` — missing information that needs human or agent validation

---

## Step 4 — Upload specs as a Paperclip artifact

After generating specs, attach them to the current issue so other agents can access them:

```bash
# Compress the spec directory
tar -czf _reversa_sdd.tar.gz _reversa_sdd/

# Upload using the Paperclip artifact helper
bash /app/skills/paperclip/scripts/paperclip-upload-artifact.sh \
  --file _reversa_sdd.tar.gz \
  --name "reversa-specs-$(basename $PWD)" \
  --issue-id "$PAPERCLIP_TASK_ID"
```

Then post a comment on the issue with the artifact link and set status to done.

---

## Available commands

| Goal | Command |
|------|---------|
| Analyze existing codebase into specs | `/reversa` |
| Start a new project from a one-line idea | `/reversa-new` |
| Evolve the system one feature at a time | `/reversa-forward` |
| Rebuild legacy on a modern stack | `/reversa-migrate` |
| Render specs as an HTML mini-site | `/reversa-docs` |
| Estimate effort and pricing from specs | `/reversa-pricing-estimate` |

For detailed descriptions and options for each command, load `references/commands.md`.

---

## CLI management commands

Run these from the project root at any time:

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
- No file in the original project is ever modified, deleted, or overwritten
- No API keys are requested, stored, or transmitted — Reversa uses whichever agent is already
  active in the environment (Claude Code in this setup)
- `npx reversa update` uses SHA-256 checksums and skips any file you have customized
