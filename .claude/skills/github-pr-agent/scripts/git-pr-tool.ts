#!/usr/bin/env -S npx tsx
/**
 * git-pr-tool — a PR-only Git/GitHub tool for AI agents.
 *
 * DESIGN PHILOSOPHY
 * -----------------
 * An autonomous agent should never be able to mutate a repository's history
 * in a way that is hard to review or undo. The single most dangerous action
 * is pushing/committing/merging directly into a default branch (main/master).
 * So this tool makes that *structurally impossible*: there is no merge command,
 * no force-push, and every write path checks the target branch against a
 * "protected" set before doing anything. The protected set is computed from
 * the repository's *real* default branch (fetched live) plus a static
 * deny-list, so even an unusually-named default branch is covered.
 *
 * The only way to change a repo is: create a fresh branch -> commit to it ->
 * open a Pull Request. Humans (or other trusted systems) merge.
 *
 * OUTPUT CONTRACT
 * ---------------
 * Every invocation prints exactly one JSON object to stdout and nothing else,
 * so an orchestrator can JSON.parse() stdout directly. Shape:
 *   success: { "ok": true,  "command": "<cmd>", "data": { ... } }
 *   failure: { "ok": false, "command": "<cmd>", "error": { code, message, details? } }
 * Process exit code is 0 on success and 1 on any handled error.
 */

import { parseArgs, type ParseArgsConfig } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";
import { Octokit } from "@octokit/rest";

// ---------------------------------------------------------------------------
// Result plumbing
// ---------------------------------------------------------------------------

class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

function emitOk(command: string, data: unknown): never {
  process.stdout.write(JSON.stringify({ ok: true, command, data }, null, 2) + "\n");
  process.exit(0);
}

function emitErr(command: string, err: unknown): never {
  const e =
    err instanceof AppError
      ? { code: err.code, message: err.message, details: err.details }
      : { code: "UNEXPECTED", message: err instanceof Error ? err.message : String(err) };
  process.stdout.write(JSON.stringify({ ok: false, command, error: e }, null, 2) + "\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Token-based auth: we read GITHUB_TOKEN from the environment, never from argv,
 *  so the secret never lands in shell history or process listings. */
function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token || !token.trim()) {
    throw new AppError(
      "NO_TOKEN",
      "GITHUB_TOKEN environment variable is not set. Export a token before running write/API commands.",
    );
  }
  return token.trim();
}

function getOctokit(): Octokit {
  return new Octokit({ auth: getToken() });
}

/** Build an authenticated clone/push URL. The token is embedded in the URL so
 *  git can authenticate over HTTPS; we redact it whenever we echo a URL. */
function authUrl(owner: string, repo: string, token: string): string {
  return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
}

function redact(url: string): string {
  return url.replace(/x-access-token:[^@]+@/, "x-access-token:***@");
}

function parseRepo(repo: string | undefined): { owner: string; repo: string } {
  if (!repo) throw new AppError("BAD_ARG", "--repo is required, in the form owner/name");
  const m = repo.match(/^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  if (!m) throw new AppError("BAD_ARG", `--repo must look like "owner/name", got: ${repo}`);
  return { owner: m[1], repo: m[2] };
}

// ---------------------------------------------------------------------------
// Protected-branch enforcement (the heart of the PR-only guarantee)
// ---------------------------------------------------------------------------

/** Static deny-list, extendable via the PROTECTED_BRANCHES env (comma-separated). */
function staticProtected(): Set<string> {
  const base = ["main", "master"];
  const extra = (process.env.PROTECTED_BRANCHES ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  return new Set([...base, ...extra]);
}

/** Detect a local clone's default branch from origin/HEAD without needing the API. */
async function detectDefaultBranchLocal(git: SimpleGit): Promise<string | null> {
  try {
    const ref = (await git.raw(["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"])).trim();
    // e.g. "refs/remotes/origin/main" -> "main"
    const parts = ref.split("/");
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

/** The full protected set = static deny-list + the repo's real default branch. */
async function protectedSetForLocal(git: SimpleGit): Promise<Set<string>> {
  const set = staticProtected();
  const def = await detectDefaultBranchLocal(git);
  if (def) set.add(def);
  return set;
}

function assertNotProtected(branch: string, set: Set<string>): void {
  if (set.has(branch)) {
    throw new AppError(
      "PROTECTED_BRANCH",
      `Refusing to operate on protected branch "${branch}". This tool is PR-only: ` +
        `create a new feature branch and open a Pull Request instead. ` +
        `Protected branches: ${[...set].join(", ")}.`,
      { branch, protected: [...set] },
    );
  }
}

// ---------------------------------------------------------------------------
// Small arg-parsing helper
// ---------------------------------------------------------------------------

function parse(rest: string[], options: ParseArgsConfig["options"]): Record<string, any> {
  const { values } = parseArgs({ args: rest, options, allowPositionals: false, strict: true });
  return values as Record<string, any>;
}

function required<T>(v: T | undefined, name: string): T {
  if (v === undefined || v === null || v === "") {
    throw new AppError("BAD_ARG", `Missing required argument: --${name}`);
  }
  return v;
}

// ---------------------------------------------------------------------------
// READ operations
// ---------------------------------------------------------------------------

const IGNORED_DIRS = new Set([".git", "node_modules", ".DS_Store"]);

async function walkTree(
  root: string,
  rel: string,
  maxDepth: number,
  depth: number,
  out: { path: string; type: "file" | "dir" }[],
): Promise<void> {
  if (depth > maxDepth) return;
  const dirents = await fs.readdir(path.join(root, rel), { withFileTypes: true });
  for (const d of dirents.sort((a, b) => a.name.localeCompare(b.name))) {
    if (IGNORED_DIRS.has(d.name)) continue;
    const childRel = rel ? `${rel}/${d.name}` : d.name;
    if (d.isDirectory()) {
      out.push({ path: childRel, type: "dir" });
      await walkTree(root, childRel, maxDepth, depth + 1, out);
    } else {
      out.push({ path: childRel, type: "file" });
    }
  }
}

async function cmdClone(rest: string[]) {
  const v = parse(rest, {
    repo: { type: "string" },
    dir: { type: "string" },
    depth: { type: "string" },
    branch: { type: "string" },
  });
  const { owner, repo } = parseRepo(v.repo);
  const token = getToken();
  const dir = v.dir ?? path.join(process.cwd(), "repos", repo);
  const args: string[] = [];
  if (v.depth) args.push("--depth", String(v.depth));
  if (v.branch) args.push("--branch", String(v.branch));
  await simpleGit().clone(authUrl(owner, repo, token), dir, args);
  const git = simpleGit(dir);
  const defaultBranch = await detectDefaultBranchLocal(git);
  emitOk("clone", {
    dir,
    repo: `${owner}/${repo}`,
    defaultBranch,
    cloneUrl: redact(authUrl(owner, repo, token)),
    note: "The clone's .git/config holds an auth token; treat the clone as ephemeral/secret.",
  });
}

async function cmdFetch(rest: string[]) {
  const v = parse(rest, { dir: { type: "string" } });
  const dir = required(v.dir, "dir");
  const git = simpleGit(dir);
  await git.fetch(["--all", "--prune"]);
  const status = await git.status();
  emitOk("fetch", { dir, currentBranch: status.current, tracking: status.tracking });
}

async function cmdListTree(rest: string[]) {
  const v = parse(rest, {
    dir: { type: "string" },
    repo: { type: "string" },
    ref: { type: "string" },
    subpath: { type: "string" },
    "max-depth": { type: "string" },
  });
  const maxDepth = v["max-depth"] ? parseInt(v["max-depth"], 10) : 100;

  // API mode: no local clone needed.
  if (v.repo) {
    const { owner, repo } = parseRepo(v.repo);
    const octokit = getOctokit();
    const ref = v.ref ?? (await octokit.repos.get({ owner, repo })).data.default_branch;
    const branch = await octokit.repos.getBranch({ owner, repo, branch: ref });
    const sha = branch.data.commit.sha;
    const tree = await octokit.git.getTree({ owner, repo, tree_sha: sha, recursive: "true" });
    let entries = tree.data.tree.map((t) => ({
      path: t.path ?? "",
      type: t.type === "tree" ? "dir" : "file",
    }));
    if (v.subpath) entries = entries.filter((e) => e.path.startsWith(v.subpath));
    emitOk("list-tree", {
      source: "api",
      repo: `${owner}/${repo}`,
      ref,
      truncated: tree.data.truncated,
      count: entries.length,
      entries,
    });
  }

  // Local mode.
  const dir = required(v.dir, "dir (or pass --repo for API mode)");
  const root = v.subpath ? path.join(dir, v.subpath) : dir;
  const out: { path: string; type: "file" | "dir" }[] = [];
  await walkTree(root, "", maxDepth, 1, out);
  emitOk("list-tree", { source: "local", dir: root, count: out.length, entries: out });
}

async function cmdReadFile(rest: string[]) {
  const v = parse(rest, {
    dir: { type: "string" },
    repo: { type: "string" },
    path: { type: "string" },
    ref: { type: "string" },
    "max-bytes": { type: "string" },
  });
  const filePath = required(v.path, "path");
  const maxBytes = v["max-bytes"] ? parseInt(v["max-bytes"], 10) : 1_000_000;

  if (v.repo) {
    const { owner, repo } = parseRepo(v.repo);
    const octokit = getOctokit();
    const res = await octokit.repos.getContent({ owner, repo, path: filePath, ref: v.ref });
    const data: any = res.data;
    if (Array.isArray(data) || data.type !== "file") {
      throw new AppError("NOT_A_FILE", `Path is not a file: ${filePath}`);
    }
    const content = Buffer.from(data.content, data.encoding as BufferEncoding).toString("utf8");
    emitOk("read-file", {
      source: "api",
      repo: `${owner}/${repo}`,
      path: filePath,
      ref: v.ref ?? null,
      size: data.size,
      sha: data.sha,
      content: content.slice(0, maxBytes),
      truncated: content.length > maxBytes,
    });
  }

  const dir = required(v.dir, "dir (or pass --repo for API mode)");
  const abs = path.join(dir, filePath);
  const buf = await fs.readFile(abs);
  emitOk("read-file", {
    source: "local",
    path: filePath,
    size: buf.length,
    content: buf.toString("utf8").slice(0, maxBytes),
    truncated: buf.length > maxBytes,
  });
}

// ---------------------------------------------------------------------------
// WRITE operations (PR-only)
// ---------------------------------------------------------------------------

async function cmdCreateBranch(rest: string[]) {
  const v = parse(rest, {
    dir: { type: "string" },
    name: { type: "string" },
    from: { type: "string" },
  });
  const dir = required(v.dir, "dir");
  const name = required(v.name, "name");
  const git = simpleGit(dir);

  // The new branch name itself must not be a protected/default branch.
  const protectedSet = await protectedSetForLocal(git);
  assertNotProtected(name, protectedSet);

  const from = v.from ?? (await detectDefaultBranchLocal(git)) ?? "HEAD";
  await git.fetch(["origin"]).catch(() => undefined);
  // Branch off the requested base, then check the new branch out.
  await git.checkout(from).catch(() => undefined);
  await git.checkoutBranch(name, from);
  emitOk("create-branch", { dir, branch: name, from, protected: [...protectedSet] });
}

async function cmdCommit(rest: string[]) {
  const v = parse(rest, {
    dir: { type: "string" },
    message: { type: "string" },
    files: { type: "string" }, // comma-separated; omit to stage all changes
    "no-push": { type: "boolean" },
  });
  const dir = required(v.dir, "dir");
  const message = required(v.message, "message");
  const git = simpleGit(dir);

  // GUARD: never commit/push while on a protected branch.
  const current = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
  const protectedSet = await protectedSetForLocal(git);
  assertNotProtected(current, protectedSet);

  const files = v.files
    ? String(v.files)
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
    : ".";
  await git.add(files);

  const status = await git.status();
  if (status.staged.length === 0) {
    throw new AppError("NOTHING_STAGED", "No changes staged to commit.", { files });
  }

  const commit = await git.commit(message);
  const fullSha = (await git.revparse(["HEAD"])).trim();

  let pushed = false;
  if (!v["no-push"]) {
    // Plain push to the feature branch only. No --force, ever.
    await git.push(["-u", "origin", current]);
    pushed = true;
  }

  emitOk("commit", {
    dir,
    branch: current,
    commit: fullSha,
    shortSha: commit.commit,
    stagedFiles: status.staged,
    pushed,
  });
}

async function cmdOpenPr(rest: string[]) {
  const v = parse(rest, {
    repo: { type: "string" },
    head: { type: "string" },
    base: { type: "string" },
    title: { type: "string" },
    body: { type: "string" },
    draft: { type: "boolean" },
  });
  const { owner, repo } = parseRepo(v.repo);
  const head = required(v.head, "head");
  const title = required(v.title, "title");
  const octokit = getOctokit();

  const base = v.base ?? (await octokit.repos.get({ owner, repo })).data.default_branch;

  // GUARD: the head (source) branch must not be a protected branch, and must
  // differ from the base. A PR is only meaningful from a feature branch.
  const protectedSet = staticProtected();
  protectedSet.add(base);
  assertNotProtected(head, protectedSet);
  if (head === base) {
    throw new AppError("BAD_ARG", `head and base cannot be the same branch ("${head}").`);
  }

  const pr = await octokit.pulls.create({
    owner,
    repo,
    head,
    base,
    title,
    body: v.body,
    draft: !!v.draft,
  });
  emitOk("open-pr", {
    repo: `${owner}/${repo}`,
    number: pr.data.number,
    url: pr.data.html_url,
    state: pr.data.state,
    head,
    base,
    draft: pr.data.draft,
  });
}

// ---------------------------------------------------------------------------
// CODE REVIEW operations
// ---------------------------------------------------------------------------

async function cmdGetPr(rest: string[]) {
  const v = parse(rest, {
    repo: { type: "string" },
    number: { type: "string" },
    "include-diff": { type: "boolean" },
  });
  const { owner, repo } = parseRepo(v.repo);
  const pull_number = parseInt(required(v.number, "number"), 10);
  const octokit = getOctokit();

  const pr = await octokit.pulls.get({ owner, repo, pull_number });
  const files = await octokit.paginate(octokit.pulls.listFiles, { owner, repo, pull_number });

  const data: Record<string, unknown> = {
    repo: `${owner}/${repo}`,
    number: pull_number,
    title: pr.data.title,
    state: pr.data.state,
    url: pr.data.html_url,
    author: pr.data.user?.login,
    head: { ref: pr.data.head.ref, sha: pr.data.head.sha },
    base: { ref: pr.data.base.ref, sha: pr.data.base.sha },
    mergeable: pr.data.mergeable,
    additions: pr.data.additions,
    deletions: pr.data.deletions,
    changedFiles: pr.data.changed_files,
    files: files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch ?? null, // per-file unified diff hunk
    })),
  };

  if (v["include-diff"]) {
    const diff = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner,
      repo,
      pull_number,
      mediaType: { format: "diff" },
    });
    data.diff = diff.data as unknown as string;
  }

  emitOk("get-pr", data);
}

async function cmdReviewPr(rest: string[]) {
  const v = parse(rest, {
    repo: { type: "string" },
    number: { type: "string" },
    event: { type: "string" }, // APPROVE | REQUEST_CHANGES | COMMENT
    body: { type: "string" },
    "comments-file": { type: "string" }, // JSON array of {path,line,side?,body}
  });
  const { owner, repo } = parseRepo(v.repo);
  const pull_number = parseInt(required(v.number, "number"), 10);
  const event = (v.event ?? "COMMENT").toUpperCase();
  if (!["APPROVE", "REQUEST_CHANGES", "COMMENT"].includes(event)) {
    throw new AppError("BAD_ARG", `--event must be APPROVE, REQUEST_CHANGES, or COMMENT.`);
  }
  const octokit = getOctokit();

  let comments: any[] | undefined;
  if (v["comments-file"]) {
    const raw = await fs.readFile(v["comments-file"], "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new AppError("BAD_ARG", "comments-file must contain a JSON array.");
    comments = parsed.map((c: any) => ({
      path: c.path,
      line: c.line,
      side: c.side ?? "RIGHT",
      body: c.body,
    }));
  }

  const review = await octokit.pulls.createReview({
    owner,
    repo,
    pull_number,
    event: event as "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
    body: v.body,
    comments,
  });
  emitOk("review-pr", {
    repo: `${owner}/${repo}`,
    number: pull_number,
    reviewId: review.data.id,
    event,
    state: review.data.state,
    inlineComments: comments?.length ?? 0,
  });
}

async function cmdCommentLine(rest: string[]) {
  const v = parse(rest, {
    repo: { type: "string" },
    number: { type: "string" },
    path: { type: "string" },
    line: { type: "string" },
    side: { type: "string" }, // RIGHT (new) | LEFT (old); default RIGHT
    body: { type: "string" },
  });
  const { owner, repo } = parseRepo(v.repo);
  const pull_number = parseInt(required(v.number, "number"), 10);
  const filePath = required(v.path, "path");
  const line = parseInt(required(v.line, "line"), 10);
  const body = required(v.body, "body");
  const octokit = getOctokit();

  // A single review comment must be anchored to the PR's head commit.
  const pr = await octokit.pulls.get({ owner, repo, pull_number });
  const comment = await octokit.pulls.createReviewComment({
    owner,
    repo,
    pull_number,
    body,
    commit_id: pr.data.head.sha,
    path: filePath,
    line,
    side: (v.side ?? "RIGHT") as "RIGHT" | "LEFT",
  });
  emitOk("comment-line", {
    repo: `${owner}/${repo}`,
    number: pull_number,
    commentId: comment.data.id,
    url: comment.data.html_url,
    path: filePath,
    line,
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

async function cmdVerifyAuth() {
  const octokit = getOctokit();
  const me = await octokit.users.getAuthenticated();
  emitOk("verify-auth", { login: me.data.login, id: me.data.id, type: me.data.type });
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const HELP = `git-pr-tool — PR-only Git/GitHub tool for agents

READ:
  clone        --repo owner/name [--dir <path>] [--depth N] [--branch <b>]
  fetch        --dir <path>
  list-tree    (--dir <path> | --repo owner/name [--ref <r>]) [--subpath <p>] [--max-depth N]
  read-file    (--dir <path> | --repo owner/name [--ref <r>]) --path <file> [--max-bytes N]

WRITE (PR-only — never touches main/master):
  create-branch --dir <path> --name <branch> [--from <base>]
  commit        --dir <path> --message <msg> [--files a,b,c] [--no-push]
  open-pr       --repo owner/name --head <branch> --title <t> [--base <b>] [--body <text>] [--draft]

REVIEW:
  get-pr        --repo owner/name --number N [--include-diff]
  review-pr     --repo owner/name --number N --event APPROVE|REQUEST_CHANGES|COMMENT [--body <t>] [--comments-file <json>]
  comment-line  --repo owner/name --number N --path <file> --line N [--side RIGHT|LEFT] --body <t>

UTIL:
  verify-auth

Auth: export GITHUB_TOKEN. Protected branches: main, master (+ PROTECTED_BRANCHES env, + repo default).
`;

async function main() {
  const [, , command, ...rest] = process.argv;
  try {
    switch (command) {
      case "clone": return await cmdClone(rest);
      case "fetch": return await cmdFetch(rest);
      case "list-tree": return await cmdListTree(rest);
      case "read-file": return await cmdReadFile(rest);
      case "create-branch": return await cmdCreateBranch(rest);
      case "commit": return await cmdCommit(rest);
      case "open-pr": return await cmdOpenPr(rest);
      case "get-pr": return await cmdGetPr(rest);
      case "review-pr": return await cmdReviewPr(rest);
      case "comment-line": return await cmdCommentLine(rest);
      case "verify-auth": return await cmdVerifyAuth();
      case "help":
      case "--help":
      case undefined:
        process.stdout.write(HELP);
        process.exit(0);
      default:
        emitErr(command, new AppError("UNKNOWN_COMMAND", `Unknown command: ${command}. Run "help".`));
    }
  } catch (err) {
    emitErr(command ?? "unknown", err);
  }
}

main();
