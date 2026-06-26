# Principle 5 — Strict Git Cleanliness

## Why This Matters for AI Agents

LLMs interact natively with plain text. Binary files, secrets, and undocumented code create blind spots: agents cannot read binaries, may leak or misuse secrets they encounter, and cannot reason about code without context.

## No Binary Files in Git

Binary files in the repository waste context tokens on file path listings and can never be read by agents. Use text equivalents.

**Banned extensions** — add these to `.gitignore`:
```
# Documents
*.pdf
*.docx
*.xlsx
*.pptx

# Images (use public/ or CDN; commit SVG as text instead)
*.png
*.jpg
*.jpeg
*.gif
*.webp
*.ico   # exception: favicon.ico at root is acceptable

# Media
*.mp4
*.mov
*.mp3

# Archives
*.zip
*.tar.gz

# IDE artifacts
.DS_Store
Thumbs.db
```

**Exceptions:**
- `favicon.ico` at the project root
- Small test fixtures (e.g., `tests/fixtures/sample.png`) where the binary is the subject of the test — document this in a `tests/fixtures/README.md`

**For design assets:** store in Figma, Notion, or a CDN. Link to them from `docs/`. Do not commit PSDs or Sketch files.

## Secrets Management

**Never commit:**
- `.env` files with real values
- API keys, tokens, passwords anywhere in source
- Private keys or certificates

**Always commit:**
- `.env.example` with all variable names, empty values, and comments explaining each

```bash
# .env.example
DATABASE_URL=          # PostgreSQL connection string
REDIS_URL=             # Redis connection string
BETTER_AUTH_SECRET=    # 32-byte random string — generate with: openssl rand -hex 32
ANTHROPIC_API_KEY=     # From console.anthropic.com
GITHUB_TOKEN=          # Personal access token with repo scope
```

**For secrets in CI/CD:** use the platform's secret store (GitHub Actions secrets, Docker secrets, etc.). Never inject via committed files.

**If secrets are found committed:** treat as compromised, rotate immediately, then remove with `git filter-repo` (not just a new commit — the history must be cleaned).

## Descriptive Docstrings

Agents use function signatures and docstrings to understand code without reading the full implementation. Write docstrings for:
- All exported functions and classes
- Non-obvious internal functions
- Any function whose name doesn't fully describe its behavior

```typescript
// bad — no docstring, unclear name
export function processItem(item: Item, opts?: ProcessOptions): Result {

// good — docstring explains the non-obvious
/**
 * Atomically checks out an issue for the given agent.
 * Throws ConflictError if already checked out by another agent.
 * Writes an activity log entry on success.
 */
export async function checkoutIssue(
  issueId: string,
  agentId: string,
  opts?: CheckoutOptions
): Promise<Issue> {
```

## .gitignore Template

Minimum `.gitignore` for a TypeScript monorepo:

```
# Dependencies
node_modules/
.pnpm-store/

# Build output
dist/
build/
.next/
.turbo/

# Environment
.env
.env.local
.env.*.local

# Binaries and media (see git-cleanliness.md)
*.pdf
*.xlsx
*.docx
*.png
*.jpg
*.jpeg
*.gif
*.mp4

# OS artifacts
.DS_Store
Thumbs.db

# Editor
.vscode/settings.json
*.swp

# Test coverage
coverage/
```

## Audit Check

When auditing a repository:
- Are binary files committed? (list with `git ls-files | grep -E '\.(png|pdf|xlsx|mp4)'`)
- Does `.env.example` exist and cover all variables used? (missing → create it)
- Does `.gitignore` have the binary ban list? (missing → add it)
- Are exported functions documented? (spot-check 5 random exports)
- Any secrets detectable in history? (use `git log --all -S 'sk-' --oneline` pattern)
