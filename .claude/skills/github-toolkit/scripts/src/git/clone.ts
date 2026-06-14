/**
 * clone_repo — copy a GitHub repository to a local working directory.
 *
 * Decoupled from auth: it receives a `GitHubConnection` and asks *it* for the
 * authenticated remote URL. This tool never reads a token, never reads the
 * environment, and never imports the connection agent's internals.
 */

import { runGit } from "../shared/exec.js";
import { ErrorCode } from "../shared/errors.js";
import { ok, err, type Result } from "../shared/result.js";
import type { GitHubConnection } from "../connection/types.js";

export interface CloneParams {
  /** "owner/name". */
  repo: string;
  /** Local destination directory. */
  dir: string;
  /** Optional shallow-clone depth. */
  depth?: number;
}

export interface CloneResult {
  dir: string;
  repo: string;
  /** The repo's default branch as reported by the API. */
  defaultBranch: string;
}

/**
 * SKILL: clone_repo
 *
 * WHAT IT DOES
 *   Clones a GitHub repository to a local directory using the caller's
 *   authenticated connection, and reports the repo's default branch.
 *
 * WHEN AN AGENT SHOULD CALL IT
 *   Before any operation that needs the repository on disk — reading files
 *   locally, creating a branch, or committing changes. This is the first step
 *   of the "change a repository" workflow. If you only need to read a file or
 *   two, prefer an API read; clone when you need the working tree.
 *
 * AUTHENTICATION
 *   Stateless. Receives the connection and asks it for an authenticated remote
 *   URL via `connection.remoteUrl()`. Never reads a token or the environment.
 *
 * @param connection  An authenticated GitHubConnection from the auth module.
 * @param params.repo  Repository in "owner/name" form. Required.
 * @param params.dir   Local destination directory for the clone. Required.
 * @param params.depth Optional shallow-clone depth (e.g. 1 for the latest commit only).
 *
 * @returns Result<CloneResult>
 *   ok:    { dir, repo, defaultBranch } — `defaultBranch` is the protected branch.
 *   error: API_REQUEST_FAILED (repo unreadable) | GIT_COMMAND_FAILED (clone failed).
 *
 * @example
 *   const r = await cloneRepo(connection, { repo: "octocat/hello-world", dir: "./work" });
 *   if (isErr(r)) handle(r.error); else console.log(r.data.defaultBranch);
 */
export async function cloneRepo(
  connection: GitHubConnection,
  params: CloneParams,
): Promise<Result<CloneResult>> {
  const { repo, dir, depth } = params;

  // Ask the API (via the connection) for the default branch up front so callers
  // know which branch is protected without parsing git output.
  const meta = await connection.api<{ default_branch: string }>(
    "GET",
    `/repos/${repo}`,
  );
  if (!meta.ok) {
    return err(ErrorCode.API_REQUEST_FAILED, `Could not read ${repo} (${meta.status}).`);
  }

  const args = ["clone"];
  if (depth) args.push("--depth", String(depth));
  args.push(connection.remoteUrl(repo), dir);

  const r = await runGit(args);
  if (r.code !== 0) {
    return err(ErrorCode.GIT_COMMAND_FAILED, "git clone failed.", {
      // stderr may contain the tokenised URL — redact before surfacing.
      stderr: r.stderr.replace(/x-access-token:[^@]+@/g, "x-access-token:***@").trim(),
    });
  }

  return ok({ dir, repo, defaultBranch: meta.body.default_branch });
}
