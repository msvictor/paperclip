# Principle 6 — RAG-Readiness

## The Goal

Make the entire codebase instantly ingestible by an AI agent without requiring it to traverse hundreds of files. Two approaches: **Repomix** for one-shot full-repo packing, **Reversa** for structured SDD generation.

## Repomix — Full Repo as a Single File

Repomix compresses the entire repository tree, file maps, and source into a single token-counted, AI-optimized text file. Use it when you need to give an agent the full picture of a project in one shot.

### Installation
```bash
npx repomix --version   # no install needed, run via npx
```

### Usage
```bash
# Pack the whole repo into repomix-output.txt
npx repomix

# Pack only src/ and docs/
npx repomix --include "src/**,docs/**"

# Exclude large generated files
npx repomix --ignore "dist/**,node_modules/**,coverage/**"

# Output as XML (better token efficiency for some models)
npx repomix --style xml
```

### When to regenerate
- Before a major refactor task (gives the agent a full snapshot)
- After significant feature merges
- Do NOT commit `repomix-output.txt` — add it to `.gitignore`

```
# .gitignore addition
repomix-output.txt
repomix-output.xml
```

### Recommended config file
Create `repomix.config.json` at the repo root and commit it:

```json
{
  "output": {
    "style": "xml",
    "filePath": "repomix-output.xml",
    "removeComments": false,
    "showLineNumbers": true,
    "topFilesLength": 20
  },
  "ignore": {
    "useGitignore": true,
    "customPatterns": [
      "dist/**",
      "coverage/**",
      "*.lock",
      "repomix-output.*"
    ]
  }
}
```

## Reversa — Structured SDD

Reversa analyzes the codebase and generates a structured Software Design Document (SDD) — domain model, architecture maps, flowcharts, data dictionary. Use it when agents need to understand the domain, not just the code.

See the `reversa` skill for full usage. In brief:

```bash
# Install per-project
npx reversa install

# Run analysis (outputs to _reversa_sdd/ and docs/reversa/ or Obsidian vault)
/reversa
```

### When to regenerate
- After adding a new domain entity or service
- Before assigning a new agent to the project
- After a major refactor (architecture changes)

The Reversa SDD should be stored in:
- `docs/reversa/` (in-repo, agents can read directly)
- OR the Obsidian vault at `03-reversa/<project-name>/` (for cross-project visibility)

## MCP Server (Optional — Advanced)

For large codebases where even Repomix output is too large, expose the codebase as an MCP (Model Context Protocol) server. This lets agents execute semantic searches natively without loading the full repo.

Tools: `repobase` (npm), custom MCP server with vector search.

This is opt-in — only set it up when:
- The repo is >500 files
- Agents frequently run out of context traversing it
- You need semantic search across the codebase

## Audit Check

When auditing a repository:
- Does a `repomix.config.json` exist? (missing → create it, do not commit output files)
- Has Reversa been run recently? (check `docs/reversa/` or Obsidian vault; stale if >30 days since last major change)
- Is `repomix-output.*` in `.gitignore`? (missing → add it)
- Is the Reversa SDD accessible to agents? (in-repo `docs/reversa/` or mounted Obsidian path)
