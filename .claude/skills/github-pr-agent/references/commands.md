# Command reference

All commands: `npx tsx scripts/git-pr-tool.ts <command> [flags]`. Output is always a single JSON
object on stdout. Exit code 0 = success, 1 = handled error.

Envelope:
```json
{ "ok": true,  "command": "<cmd>", "data": { ... } }
{ "ok": false, "command": "<cmd>", "error": { "code": "...", "message": "...", "details": ... } }
```

## Table of contents
- READ: `clone`, `fetch`, `list-tree`, `read-file`
- WRITE: `create-branch`, `commit`, `open-pr`
- REVIEW: `get-pr`, `review-pr`, `comment-line`
- UTIL: `verify-auth`
- Error codes

---

## READ

### clone
Clone a repo using token auth. Flags: `--repo owner/name` (req), `--dir <path>` (default `./repos/<name>`), `--depth N`, `--branch <b>`.
`data`: `{ dir, repo, defaultBranch, cloneUrl (redacted), note }`.

### fetch
`git fetch --all --prune` in an existing clone. Flags: `--dir <path>` (req).
`data`: `{ dir, currentBranch, tracking }`.

### list-tree
List a directory tree. Two modes:
- API: `--repo owner/name [--ref <branch>]` — no clone needed.
- Local: `--dir <path>`.
Optional both: `--subpath <p>`, `--max-depth N`.
`data`: `{ source, count, entries: [{ path, type: "file"|"dir" }], ... }`. `.git`/`node_modules` are skipped.

### read-file
Read one file. Modes: `--repo owner/name [--ref <branch>]` or `--dir <path>`. Required: `--path <file>`. Optional `--max-bytes N` (default 1,000,000).
`data`: `{ source, path, size, content, truncated, ... }`.

---

## WRITE (PR-only)

### create-branch
Create and check out a new feature branch. Flags: `--dir <path>` (req), `--name <branch>` (req), `--from <base>` (default: repo default branch).
Refuses (`PROTECTED_BRANCH`) if `--name` is `main`, `master`, a `PROTECTED_BRANCHES` entry, or the detected default.
`data`: `{ dir, branch, from, protected: [...] }`.

### commit
Stage, commit, and (by default) push the current feature branch. Flags: `--dir <path>` (req), `--message <msg>` (req), `--files a,b,c` (default: all changes), `--no-push`.
Refuses (`PROTECTED_BRANCH`) if the current branch is protected. Never force-pushes.
`data`: `{ dir, branch, commit (full sha), shortSha, stagedFiles, pushed }`.

### open-pr
Open a Pull Request. Flags: `--repo owner/name` (req), `--head <branch>` (req), `--title <t>` (req), `--base <b>` (default: repo default), `--body <text>`, `--draft`.
Refuses if `--head` is protected or equals `--base`.
`data`: `{ repo, number, url, state, head, base, draft }`.

---

## REVIEW

### get-pr
Fetch PR metadata and changed files. Flags: `--repo owner/name` (req), `--number N` (req), `--include-diff` (adds full unified diff string).
`data`: `{ repo, number, title, state, url, author, head{ref,sha}, base{ref,sha}, mergeable, additions, deletions, changedFiles, files: [{ filename, status, additions, deletions, patch }], diff? }`.

### review-pr
Submit a review, optionally with inline comments. Flags: `--repo owner/name` (req), `--number N` (req), `--event APPROVE|REQUEST_CHANGES|COMMENT` (default COMMENT), `--body <t>`, `--comments-file <path>` (JSON array of `{path, line, side?, body}`; `side` defaults to `RIGHT`).
`data`: `{ repo, number, reviewId, event, state, inlineComments }`.

### comment-line
Post one inline review comment, anchored to the PR head commit. Flags: `--repo owner/name` (req), `--number N` (req), `--path <file>` (req), `--line N` (req), `--side RIGHT|LEFT` (default RIGHT), `--body <t>` (req).
`data`: `{ repo, number, commentId, url, path, line }`.

> Note on `side`: `RIGHT` targets a line in the new version of the file; `LEFT` targets the old version. Line numbers come from the diff in `get-pr`.

---

## UTIL

### verify-auth
Confirm the token works. `data`: `{ login, id, type }`.

---

## Error codes
- `NO_TOKEN` — `GITHUB_TOKEN` not set.
- `BAD_ARG` — missing/invalid flag.
- `PROTECTED_BRANCH` — attempted a write on main/master/default/protected branch. **Change approach: use a feature branch.**
- `NOTHING_STAGED` — commit found no staged changes (did you edit files in the clone?).
- `NOT_A_FILE` — `read-file --path` pointed at a directory.
- `UNKNOWN_COMMAND` — typo in the subcommand.
- `UNEXPECTED` — anything else (e.g. network/API error); see `message`.
