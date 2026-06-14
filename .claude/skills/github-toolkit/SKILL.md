---
name: github-toolkit
description: Safely read, change, review, or release GitHub repos through a PR-first toolkit. Use whenever a task touches GitHub — reading files, cloning, fixing bugs, adding features, opening or reviewing a PR, or running a release-branching flow (cut a release branch, merge feature PRs into it, prep the PR into main) — even from just a repo or PR URL. Never commits to main/master/release and never merges into main/master; that final merge stays human-only.
---

# GitHub Toolkit

A small, safe toolkit for operating on Git repositories and GitHub. It is built on one idea:
**separate authentication from operations.** A connection layer owns the token and proves who
you are; a set of stateless git tools do the work and never touch the credential. On top of
that sits a single CLI you drive one command at a time.

Every change to a repository goes through a **new branch and a Pull Request**. The tool refuses
to commit or push to `main`, `master`, or any `release` branch — code reaches those only through a
reviewed PR. It *can* merge feature PRs into a `release` branch (that's the integration step of
the release flow), but it will **never merge into `main`/`master`**: that final landing is a
human-only action. These guards live in the code, not in these instructions, so you cannot talk
the tool into bypassing them.

## When to reach for which workflow

There are four jobs this skill does. Pick by what the user actually wants:

- **Read** a repo — they want to understand or quote code, not change it. Use `read-file` /
  `list-tree` over the API (no clone), or `clone` if you need the whole tree on disk.
- **Change** a repo — they want a fix or feature shipped. Clone → branch → edit → commit → open
  a PR. This is the core flow and the only way to write code with this tool.
- **Review** a PR — they want feedback on someone's changes. `get-pr` → `list-pr-files` →
  `review-pr`. Reviewing never writes code, so it's always safe.
- **Release** a set of changes — they're running the staged `main` ← `release` ← feature flow:
  cutting a release branch, merging approved feature PRs into it, and prepping the PR into `main`.
  See "Release Branching workflow" below and `references/release-branching.md` for the full
  six-step process.

## Why PR-only

Direct commits to a default branch are the hardest action to review or undo. Forcing every
change onto a feature branch and through a PR means a human always gets to review before
anything lands. If you try to commit while on a protected branch you'll get a `PROTECTED_BRANCH`
error — that's expected; create a feature branch first and retry.

## Setup (once per session)

The toolkit lives in `scripts/`. From the skill directory:

```bash
cd scripts
npm install
export GITHUB_TOKEN=ghp_xxx          # see references/setup.md for how to create one
npx tsx src/cli.ts verify-auth        # confirm the token works
```

`verify-auth` prints your identity and granted scopes. If it returns `MISSING_TOKEN` or
`INVALID_TOKEN`, fix the token before doing anything else — every other command authenticates
first and will fail the same way.

## The command contract

Run every command as:

```bash
npx tsx src/cli.ts <command> [--flag value ...]
```

Each command **authenticates once and prints exactly one JSON object** to stdout, then exits.
Parse that one object — don't scrape human text. The shape is uniform:

```jsonc
// success, exit 0:
{ "ok": true,  "command": "open-pr", "data": { ... } }
// failure, exit 1:
{ "ok": false, "command": "open-pr", "error": { "code": "...", "message": "...", "details": {} } }
```

Branch on `ok`. The `code` is stable and machine-readable (see "Error codes" below); the
`message` is safe to show the user. Tokens are never printed — any token that leaks into git
output is redacted before you see it.

## Commands

### Read (no clone)

```bash
# List the top level of a repo (add --recursive for the whole tree, --ref for a branch/tag/SHA):
npx tsx src/cli.ts list-tree --repo owner/name
npx tsx src/cli.ts list-tree --repo owner/name --recursive --ref develop

# Read one file's contents:
npx tsx src/cli.ts read-file --repo owner/name --path src/index.ts
```

Prefer these when you need a few files. Clone when you need many files, the full history, or to
build/run the code.

### Change a repo via PR

Do these in order. Each step's output feeds the next.

```bash
# 1. Clone. Reports the repo's default branch (the protected one).
npx tsx src/cli.ts clone --repo owner/name --dir ./work

# 2. Branch BEFORE editing. Name it for the task.
npx tsx src/cli.ts create-branch --dir ./work --name fix/login-typo

# 3. Edit files on disk with your normal file tools (Read/Edit/Write) inside ./work.

# 4. Commit + push (push is on by default; pass --no-push to stage a commit only).
npx tsx src/cli.ts commit --dir ./work --repo owner/name --message "fix: correct login typo"

# 5. Open the PR. --base defaults to the repo's default branch.
npx tsx src/cli.ts open-pr --repo owner/name --head fix/login-typo --title "Fix login typo" \
  --body "Corrects a typo on the login screen." [--draft]
```

Notes that save round-trips:
- **Always `create-branch` before editing.** If you edit on the default branch, `commit` will
  refuse with `PROTECTED_BRANCH` and you'll have to redo the edits on a feature branch.
- **Nothing to commit is not a crash.** `commit` returns `WORKING_TREE_CLEAN` if there are no
  changes — check your edits actually landed in `./work`.
- **`commit --paths a,b`** stages only those pathspecs; the default stages everything.

### Review a PR

```bash
# 1. Orient: title, author, state, head/base.
npx tsx src/cli.ts get-pr --repo owner/name --number 42

# 2. Read the diff. Each file has a `patch` (unified diff) and line counts.
npx tsx src/cli.ts list-pr-files --repo owner/name --number 42

# 3a. Submit a review. Default event is COMMENT (feedback, no verdict).
npx tsx src/cli.ts review-pr --repo owner/name --number 42 \
  --body "Looks solid overall, two small notes." \
  --comments '[{"path":"src/auth.ts","line":88,"body":"This can throw if token is empty — guard it."}]'

# 3b. Or a quick top-level comment with no line anchoring:
npx tsx src/cli.ts comment-pr --repo owner/name --number 42 --body "Can you add a test for the empty-token case?"
```

About `review-pr`:
- `--comments` is a JSON array of `{ "path", "line", "body" }`. **`line` is the line number in
  the file's NEW version** — the right side of the diff you read in `list-pr-files`. If a line
  isn't part of the diff, GitHub rejects it with `API_REQUEST_FAILED`; re-check against the
  `patch`.
- `--event` is `COMMENT` (default), `APPROVE`, or `REQUEST_CHANGES`. **Default to COMMENT.** Only
  `APPROVE` or `REQUEST_CHANGES` when the user explicitly asks for a verdict — approving a PR
  signs off on it in the user's name, which is a human's call to make.
- Bundle all feedback into **one** `review-pr` call rather than many scattered comments.

### Release branching

A staged flow where work lands on `main` only through an integration `release` branch. Two extra
commands support it; read `references/release-branching.md` for the full six-step walkthrough.

Release branches are **versioned** — `release/vX.Y.Z` — so the version records which release each
feature shipped in. Use the real target version (`release/v1.4.0`, `release/v2.0.0-rc.1`).

```bash
# TL — step 1: cut the versioned release branch from main (API, no clone needed):
npx tsx src/cli.ts create-remote-branch --repo owner/name --name release/v1.4.0 --from main

# Dev — steps 2–3: branch off the release branch, then PR back INTO it:
npx tsx src/cli.ts create-branch --dir ./work --name feat/x --from origin/release/v1.4.0
npx tsx src/cli.ts open-pr --repo owner/name --head feat/x --base release/v1.4.0 --title "Add X"

# TL — step 4: approve and merge the feature PR INTO the release branch (allowed).
# This also stamps the PR with "✅ Merged into release v1.4.0" so the version is on record:
npx tsx src/cli.ts merge-pr --repo owner/name --number 57

# TL — step 5: open the release PR INTO main (a proposal — fine to open):
npx tsx src/cli.ts open-pr --repo owner/name --head release/v1.4.0 --base main --title "Release v1.4.0"

# Step 6 — the hard stop: do NOT merge this one. merge-pr refuses a main/master base:
npx tsx src/cli.ts merge-pr --repo owner/name --number 60   # -> PROTECTED_BRANCH (human merges)
```

What the guards do here, and why:
- **Release branches must carry a `vX.Y.Z` version.** `create-remote-branch` rejects an
  unversioned `release` (or `release/foo`) with `INVALID_ARGUMENT` — the version is the whole point,
  it's what later tells you which release a feature went out in. `release/v1.4.0`,
  `release-v2.0.0`, and `release/v1.4.0-rc.1` are all accepted.
- **`merge-pr` records the version.** On a successful merge into a versioned release branch it
  leaves a "✅ Merged into release `v1.4.0`" note on the PR and returns `releaseVersion` in its
  output, so the feature's release is documented in the thread. Pass `--no-record-version` to skip
  the note.
- **`merge-pr` is gated by the PR's base, not its number.** It looks up where the PR would land: a
  `release/*` base merges; a `main`/`master` base returns `PROTECTED_BRANCH` and merges nothing.
  Landing on a default branch is the one step a human must own, so it's enforced in code — there's
  no override flag, and a `PROTECTED_BRANCH` here is success, not a problem to solve. When you hit
  it, approve the PR with `review-pr` and tell the user to merge it themselves.
- **`commit` refuses release branches too**, not just `main`/`master`. Developers branch *off* the
  release branch and PR *into* it; nobody commits straight onto it.

## Error codes

| code | meaning | what to do |
|------|---------|------------|
| `MISSING_TOKEN` | no `GITHUB_TOKEN` set | export the token (see references/setup.md) |
| `INVALID_TOKEN` | GitHub rejected it (401) | token is wrong/expired; make a new one |
| `INSUFFICIENT_SCOPE` | token lacks a needed scope | recreate with the `repo` scope |
| `PROTECTED_BRANCH` | tried to commit to main/master/release, or merge into main/master | for a commit, use a feature branch; for a merge into main, hand off to a human |
| `WORKING_TREE_CLEAN` | nothing to commit | confirm your edits landed in the clone dir |
| `GIT_COMMAND_FAILED` | a local git command failed | read `details.stderr` |
| `API_REQUEST_FAILED` | a GitHub API call failed | read `message`/`details.status` |
| `INVALID_ARGUMENT` | a flag is missing or malformed | check the command's required flags |

## How it's built (for when you need to extend it)

The code under `scripts/src/` is deliberately layered:

```
connection/   owns the token: connect() validates GITHUB_TOKEN, captures identity + scopes.
git/          stateless tools, each (connection, params) => Result: clone, branch, commit,
              pull-request, read, review, remote-branch, merge, plus the branch guards
              (assertCommittable / assertMergeableInto enforce the release rules).
shared/       Result type, error codes, and auth-agnostic exec helpers (runGit / httpJson).
cli.ts        the dispatcher that turns one command into one JSON object.
```

The git tools import only the `GitHubConnection` **type**, never the auth implementation, so you
can swap the credential backend (classic PAT → fine-grained token → GitHub App) by editing
`connection/` alone. To add a command: drop a `(connection, params) => Result` function in
`git/`, export it from `git/index.ts`, and add a `case` to `cli.ts`. No auth code required.

`references/setup.md` covers creating a token and choosing scopes;
`references/release-branching.md` walks through the full six-step release flow.
