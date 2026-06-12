---
name: github-pr-agent
description: Perform Git and GitHub repository operations through a safe, PR-only command-line tool. Use this skill whenever the task involves reading a repository (listing files, reading file contents, cloning/fetching), making changes to a repository (editing code, fixing bugs,adding features), or reviewing a Pull Request (reading diffs, leaving review comments or line comments). Trigger it any time the user mentions GitHub, a repo, a branch, a commit a pull request / PR, a code review, or asks you to "change", "fix", "update", "open a PR for", or "review" anything in a codebase — even if they don't name the tool. The tool enforces a strict PR-only workflow at the code level -> it can NEVER push, commit, or merge into a default branch (main/master). All changes go through a new branch + Pull Request.
key: skills/github-pr-agent
recommendedForRoles:
  - engineer
tags:
  - github
  - pull-requests
  - code-review
  - release
---

# GitHub PR Agent

A command-line tool that lets you operate on Git repositories and GitHub safely. Every change
you make to a repository goes through a **new branch and a Pull Request** — the tool will refuse
to commit or push to `main`, `master`, or the repo's real default branch, and it has **no merge
command at all**. This protects the repository from unreviewable or destructive changes.

## Why PR-only

Direct commits to a default branch are the hardest action to review or undo. By forcing every
change onto a feature branch and through a PR, a human (or another trusted system) always gets to
review before anything lands. You cannot bypass this — the guard lives in the code, not in these
instructions. If you try to commit while on a protected branch, you'll get a `PROTECTED_BRANCH`
error. That's expected; create a feature branch first.

## Setup (do this once)

1. The tool lives in `scripts/git-pr-tool.ts`. From the skill directory, install deps:
   ```bash
   npm install
   ```
2. Export a token (see `references/setup.md` for how to create one):
   ```bash
   export GITHUB_TOKEN=ghp_xxx
   ```
3. Confirm auth works:
   ```bash
   npx tsx scripts/git-pr-tool.ts verify-auth
   ```

Run any command with `npx tsx scripts/git-pr-tool.ts <command> [flags]`. Every command prints
**one JSON object** to stdout. Parse it. On success it's `{"ok": true, "command", "data": {...}}`;
on failure it's `{"ok": false, "command", "error": {"code", "message", "details"}}` with exit code 1.

## The three workflows

### 1. Read a repository

To inspect code without changing anything. You can work over the API (no clone) or from a local
clone.

```bash
# Over the API — fast, no clone:
npx tsx scripts/git-pr-tool.ts list-tree --repo owner/name
npx tsx scripts/git-pr-tool.ts read-file --repo owner/name --path src/index.ts

# Or clone first, then read locally (needed before you can change anything):
npx tsx scripts/git-pr-tool.ts clone --repo owner/name --dir ./work
npx tsx scripts/git-pr-tool.ts list-tree --dir ./work
```

### 2. Change a repository (always via PR)

This is the **only** way to write. Follow these steps in order:

```bash
# 1. Clone (if you haven't already). Note the "defaultBranch" in the result.
npx tsx scripts/git-pr-tool.ts clone --repo owner/name --dir ./work

# 2. Create a NEW feature branch. Never reuse main/master.
npx tsx scripts/git-pr-tool.ts create-branch --dir ./work --name fix/login-typo

# 3. Edit files directly on disk inside ./work using your normal file tools.
#    (Write/append/replace file contents however you normally do.)

# 4. Commit and push the feature branch.
npx tsx scripts/git-pr-tool.ts commit --dir ./work --message "fix(login): correct typo in error copy"

# 5. Open the Pull Request (base defaults to the repo's default branch).
npx tsx scripts/git-pr-tool.ts open-pr --repo owner/name --head fix/login-typo \
  --title "Fix login error typo" --body "Corrects a user-facing typo on the login screen."
```

If step 4 returns `PROTECTED_BRANCH`, you skipped step 2 — you're still on the default branch.
Create a feature branch and retry.

### 3. Review a Pull Request

```bash
# Fetch metadata + per-file patches (add --include-diff for the full unified diff):
npx tsx scripts/git-pr-tool.ts get-pr --repo owner/name --number 42 --include-diff

# Post a whole review, optionally with inline comments from a JSON file:
npx tsx scripts/git-pr-tool.ts review-pr --repo owner/name --number 42 \
  --event COMMENT --body "A few suggestions below." --comments-file ./comments.json

# Or a single line comment:
npx tsx scripts/git-pr-tool.ts comment-line --repo owner/name --number 42 \
  --path src/auth.ts --line 88 --body "This can be null here — guard it."
```

The `--comments-file` is a JSON array like:
```json
[
  { "path": "src/auth.ts", "line": 88, "side": "RIGHT", "body": "Guard against null." },
  { "path": "src/auth.ts", "line": 12, "body": "Unused import." }
]
```

## Operating rules

- **Never** attempt to commit, push, or open a PR whose head is a protected branch. Use a fresh
  feature branch named for the task (e.g. `fix/...`, `feat/...`, `chore/...`).
- Edit files **only** after you've created a feature branch in that clone.
- Always read the JSON result and branch on `ok`. On an error, surface the `error.message` to the
  user rather than retrying blindly — especially `PROTECTED_BRANCH`, which means you must change
  your approach, not your arguments.
- Treat clones as ephemeral and secret: the clone's `.git/config` contains an auth token.
- The token comes only from `GITHUB_TOKEN` in the environment. Never pass secrets as flags or put
  them in commit messages, PR bodies, or comments.

## Full command reference

See `references/commands.md` for every flag, the exact JSON shape each command returns, and the
list of error codes. See `references/setup.md` for token creation and scopes.
