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

Vault at `/obsidian/` — shared Markdown knowledge base. All agents + operator access via Obsidian app on Mac. Agent writes appear immediately to operator; operator writes appear immediately to agents.

**Vault root inside container:** `/obsidian/`

Full folder reference: load `references/vault-layout.md`.

---

## Before starting any task

Check vault before reading source code:

```bash
# 1. Check for paperclip project-specific orientation
ls /obsidian/paperclip-brain/02-projects/

# 2. Read the paperclip project README if it exists
cat /obsidian/paperclip-brain/02-projects/<project-name>/README.md

# 3. Check for relevant operator paperclip specs
ls /obsidian/paperclip-brain/01-specs/
# Read any spec that matches the task topic

# 4. Check for prior Reversa analysis
ls /obsidian/paperclip-brain/03-reversa/<project-name>/ 2>/dev/null && echo "Reversa specs found"

# 5. Check recent agent notes for prior work on the same task
ls /obsidian/paperclip-brain/04-agent-notes/
```

Spec in `01-specs/` covering task → treat acceptance criteria as definition of done. Reversa analysis in `03-reversa/` → read module spec files before exploring raw source.

---

## Writing a progress note

Write at meaningful milestones — phase complete, blocked, or handoff. Not every heartbeat.

```bash
# File path pattern:
# /obsidian/04-agent-notes/<AgentName>/<YYYY-MM-DD>-<task-id>-<slug>.md
NOTE_PATH="/obsidian/paperclip-brain/04-agent-notes/TecLidio/$(date +%Y-%m-%d)-CER-18-auth-analysis.md"

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

Full conventions: `/obsidian/paperclip-brain/04-agent-notes/_conventions.md`.

---

## After a Reversa analysis

After `/reversa` completes and `_reversa_sdd/` populated, copy specs into vault:

```bash
PROJECT_NAME="voo-social-pro"
DEST="/obsidian/paperclip-brain/03-reversa/${PROJECT_NAME}"
mkdir -p "$DEST"
cp -r _reversa_sdd/. "$DEST/"
echo "Reversa specs copied to $DEST"
```

Write `type: reversa` progress note in `04-agent-notes/` pointing to new location (see conventions). Attach tarball as Paperclip artifact using paperclip skill.

---

## Generating the dashboard

Write result to `/obsidian/paperclip-brain/00-dashboard/status.md`:

```bash
# Requires PAPERCLIP_API_URL and PAPERCLIP_API_KEY to be set
COMPANY_ID="${PAPERCLIP_COMPANY_ID}"
API="${PAPERCLIP_API_URL:-http://localhost:3100}"

# Fetch open issues
ISSUES=$(curl -sf \
  -H "Authorization: Bearer ${PAPERCLIP_API_KEY}" \
  "${API}/api/companies/${COMPANY_ID}/issues?status=open&limit=50")

# Write dashboard (use the template below, populated with real data)
cat > /obsidian/paperclip-brain/00-dashboard/status.md << DASHBOARD
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

Replace comment placeholders with actual API response data. Full API reference: `skills/paperclip/references/api-reference.md`.

---

## Writing a spec (on behalf of the operator)

Draft spec → write to `01-specs/`:

```bash
# Use the template as the base
cp /obsidian/paperclip-brain/01-specs/_template.md /obsidian/paperclip-brain/01-specs/<slug>.md
# Then edit the file with the spec content
```

Name file after feature in lowercase kebab-case.

---

## Important rules

- **Never write secrets, tokens, or API keys into any vault file.**
- **Never create files outside the four numbered top-level folders** (except README.md at root).
- **Do not delete files written by the operator** in `01-specs/` or `02-projects/`.
- **Always use the frontmatter template** when writing any note — makes notes queryable in Obsidian's Dataview plugin.
- Vault on macOS filesystem. File names case-insensitive; use lowercase to avoid collisions.