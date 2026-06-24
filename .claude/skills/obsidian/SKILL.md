---
name: obsidian
description: >
  Read and write the shared Obsidian knowledge vault at /obsidian/. Use to read
  project specs and operator instructions before starting work, write milestone
  progress notes during execution, move Reversa-generated specs into the vault
  after codebase analysis, and generate a dashboard note showing current
  Paperclip issue status. The vault is a live bridge between operator knowledge
  and agent execution — always check it before assuming you have no context.
---

# Obsidian Vault

The vault at `/obsidian/` is a shared Markdown knowledge base accessible to all
agents and to the operator through the Obsidian app on their Mac. Changes written
by an agent appear immediately in the operator's Obsidian. Notes written by the
operator appear immediately to agents.

**Vault root inside container:** `/obsidian/`

For the full folder-by-folder reference, load `references/vault-layout.md`.

---

## Before starting any task

Always check the vault for existing context before reading source code:

```bash
# 1. Check for project-specific orientation
ls /obsidian/02-projects/

# 2. Read the project README if it exists
cat /obsidian/02-projects/<project-name>/README.md

# 3. Check for relevant operator specs
ls /obsidian/01-specs/
# Read any spec that matches the task topic

# 4. Check for prior Reversa analysis
ls /obsidian/03-reversa/<project-name>/ 2>/dev/null && echo "Reversa specs found"

# 5. Check recent agent notes for prior work on the same task
ls /obsidian/04-agent-notes/
```

If a spec in `01-specs/` directly covers your task, treat its acceptance criteria
as your definition of done. If you find a Reversa analysis in `03-reversa/`, read
the relevant module spec files before exploring raw source code.

---

## Writing a progress note

Write a progress note at meaningful milestones — after completing a phase, when
blocked, or when handing off to another agent. Do not write on every heartbeat.

```bash
# File path pattern:
# /obsidian/04-agent-notes/<AgentName>/<YYYY-MM-DD>-<task-id>-<slug>.md
NOTE_PATH="/obsidian/04-agent-notes/TecLidio/$(date +%Y-%m-%d)-CER-18-auth-analysis.md"

cat > "$NOTE_PATH" << 'EOF'
---
date: 2026-06-23
agent: TecLidio
project: voo-social-pro
task-id: CER-18
type: progress
status: in-progress
---

# Progress: [Task title]

## What was done

- Item 1
- Item 2

## Current state

Brief description of what the code looks like now.

## Next steps

- What remains.

## Blockers

None.
EOF
```

Follow the full conventions in `/obsidian/04-agent-notes/_conventions.md`.

---

## After a Reversa analysis

Once `/reversa` completes and `_reversa_sdd/` is populated, copy the specs into
the vault so other agents and the operator can access them:

```bash
PROJECT_NAME="voo-social-pro"
DEST="/obsidian/03-reversa/${PROJECT_NAME}"
mkdir -p "$DEST"
cp -r _reversa_sdd/. "$DEST/"
echo "Reversa specs copied to $DEST"
```

Then write a `type: reversa` progress note in `04-agent-notes/` pointing to the
new location (see conventions). Attach the tarball as a Paperclip artifact using
the paperclip skill.

---

## Generating the dashboard

When asked to generate or refresh the dashboard, call the Paperclip API and write
the result to `/obsidian/00-dashboard/status.md`:

```bash
# Requires PAPERCLIP_API_URL and PAPERCLIP_API_KEY to be set
COMPANY_ID="${PAPERCLIP_COMPANY_ID}"
API="${PAPERCLIP_API_URL:-http://localhost:3100}"

# Fetch open issues
ISSUES=$(curl -sf \
  -H "Authorization: Bearer ${PAPERCLIP_API_KEY}" \
  "${API}/api/companies/${COMPANY_ID}/issues?status=open&limit=50")

# Write dashboard (use the template below, populated with real data)
cat > /obsidian/00-dashboard/status.md << DASHBOARD
---
date: $(date +%Y-%m-%d)
type: dashboard
generated-by: $(hostname)
---

# Paperclip Dashboard

_Generated $(date '+%Y-%m-%d %H:%M')_

## Open Issues

<!-- Populate from $ISSUES — list id, title, assignee, status, priority -->

## Agents

<!-- List each agent and their current assignment -->

## Recently completed

<!-- Issues closed in the last 7 days -->
DASHBOARD
```

Replace the comment placeholders with the actual data from the API response.
The full API reference is in the paperclip skill at `skills/paperclip/references/api-reference.md`.

---

## Writing a spec (on behalf of the operator)

If asked to draft a spec (e.g. for a new feature), write it to `01-specs/`:

```bash
# Use the template as the base
cp /obsidian/01-specs/_template.md /obsidian/01-specs/<slug>.md
# Then edit the file with the spec content
```

Name the file after the feature in lowercase kebab-case.

---

## Important rules

- **Never write secrets, tokens, or API keys into any vault file.**
- **Never create files outside the four numbered top-level folders** (except README.md at root).
- **Do not delete files written by the operator** in `01-specs/` or `02-projects/`.
- **Always use the frontmatter template** when writing any note — this is what makes notes queryable in Obsidian's Dataview plugin.
- The vault is on a macOS filesystem. File names are case-insensitive; use lowercase to avoid collisions.
