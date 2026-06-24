# Agent Defaults

This file is the canonical reference for the minimum skill set every new Paperclip agent must receive.
It is for the operator — not for agents. Copy-paste the relevant command when creating a new agent.

---

## Company and agent IDs

```
COMPANY_ID=d09deba4-0a1a-43ee-aa5b-d244e27915c3
```

Current agents (update this table when new agents are added):

| Agent | ID | Adapter |
|-------|----|---------|
| TecLidio | `2a040084-73ae-47a0-8311-467ec1d321b4` | claude_local |
| Especialisto | `51d4c9b9-07d3-45bf-a06e-d17d8cd66a01` | claude_local |
| SIOWL | `0270eb2f-ae8d-4a68-89fb-03ff3720f1c1` | claude_local |
| Junin Pleno | `635a0cbf-6911-4e77-b61a-1c8849fabc7d` | gemini_local |

---

## Skill inventory (local-path IDs)

Always use these IDs in sync commands to avoid slug ambiguity:

| Skill | ID | Purpose |
|-------|----|---------|
| `caveman` | `48bbda43-4b46-4595-b9fe-160f51594aed` | Output compression (~65%) |
| `caveman-compress` | `3d8e946b-d82e-4390-acf2-5437d8436b18` | Input compression of SKILL.md files (~46%) |
| `cavecrew` | `434956ee-b8f2-4a30-976e-173b9bd2646f` | Token-efficient subagents (Claude only) |
| `github-toolkit` | slug | GitHub PR-first workflow |
| `github-pr-workflow` | slug | PR conventions |
| `reversa` | slug | Codebase reverse-engineering |
| `obsidian` | slug | Shared knowledge vault |
| `doc-maintenance` | slug | Documentation drift detection |
| `task-planning` | slug | Task decomposition |

---

## New agent skill sync commands

### Claude-based agent (claude_local or cursor_cloud)

```bash
pnpm paperclipai skills agent sync <NEW_AGENT_ID> \
  --company-id d09deba4-0a1a-43ee-aa5b-d244e27915c3 \
  --skill github-toolkit \
  --skill github-pr-workflow \
  --skill 48bbda43-4b46-4595-b9fe-160f51594aed \
  --skill 3d8e946b-d82e-4390-acf2-5437d8436b18 \
  --skill 434956ee-b8f2-4a30-976e-173b9bd2646f
```

For a senior/lead agent (add reversa + obsidian + doc-maintenance + task-planning):

```bash
pnpm paperclipai skills agent sync <NEW_AGENT_ID> \
  --company-id d09deba4-0a1a-43ee-aa5b-d244e27915c3 \
  --skill github-toolkit \
  --skill doc-maintenance \
  --skill task-planning \
  --skill github-pr-workflow \
  --skill reversa \
  --skill obsidian \
  --skill 48bbda43-4b46-4595-b9fe-160f51594aed \
  --skill 3d8e946b-d82e-4390-acf2-5437d8436b18 \
  --skill 434956ee-b8f2-4a30-976e-173b9bd2646f
```

### Gemini-based agent (gemini_local)

cavecrew skipped — its sub-agent definitions fail Gemini's tool-name validator.

```bash
pnpm paperclipai skills agent sync <NEW_AGENT_ID> \
  --company-id d09deba4-0a1a-43ee-aa5b-d244e27915c3 \
  --skill github-toolkit \
  --skill github-pr-workflow \
  --skill 48bbda43-4b46-4595-b9fe-160f51594aed \
  --skill 3d8e946b-d82e-4390-acf2-5437d8436b18
```

---

## Caveman mode reference

| Mode | Command | Use case |
|------|---------|---------|
| Default (65% output reduction) | `/caveman` or `/caveman full` | All normal tasks |
| Light | `/caveman lite` | When readable explanation is needed |
| Maximum (up to 87%) | `/caveman ultra` | Long debug/refactor loops |
| Compress a file | `/caveman-compress <filepath>` | Reduce SKILL.md / memory file input tokens |
| Stats | `/caveman-stats` | See USD savings for current session |

---

## After creating a new agent in Paperclip

1. Run the appropriate `skills agent sync` command above (use IDs for caveman/cavecrew, slugs for the rest)
2. If the agent is Claude-based, the caveman plugin is already installed in the container (`HOME=/paperclip` persists across recreations)
3. If the agent is Gemini-based, the caveman extension is already installed in the container
4. Optionally assign additional project-specific skills as needed

---

## Updating caveman skills

When a new version of caveman is released:

```bash
# Update the local files
npx -y github:JuliusBrussee/caveman -- --force

# Copy updated files into .claude/skills
cp -r .agents/skills/caveman .claude/skills/caveman
cp -r .agents/skills/caveman-compress .claude/skills/caveman-compress
cp -r .agents/skills/cavecrew .claude/skills/cavecrew

# Re-import into Paperclip (updates the skill content; agent assignments are preserved)
pnpm paperclipai skills import /skills/caveman --company-id d09deba4-0a1a-43ee-aa5b-d244e27915c3
pnpm paperclipai skills import /skills/caveman-compress --company-id d09deba4-0a1a-43ee-aa5b-d244e27915c3
pnpm paperclipai skills import /skills/cavecrew --company-id d09deba4-0a1a-43ee-aa5b-d244e27915c3

# Update Claude plugin inside container
docker exec paperclip bash -c "claude plugin marketplace add JuliusBrussee/caveman && claude plugin install caveman@caveman --force"
```
