/**
 * commit_changes — stage, commit, and push the current feature branch.
 *
 * Enforces the PR-only invariant: refuses to commit while on a protected branch.
 * Gets the token for the push from the connection's authenticated remote URL —
 * it never handles the credential itself.
 */

import { runGit } from "../shared/exec.js";
import { currentBranch, assertCommittable } from "./guards.js";
import { ErrorCode } from "../shared/errors.js";
import { ok, err, isErr, type Result } from "../shared/result.js";
import type { GitHubConnection } from "../connection/types.js";

export interface CommitParams {
  dir: string;
  /** "owner/name" — needed to build the authenticated push URL. */
  repo: string;
  message: string;
  /** Pathspecs to stage. Defaults to all changes ("."). */
  paths?: string[];
  /** Push after committing. Defaults to true. */
  push?: boolean;
}

export interface CommitResult {
  branch: string;
  sha: string;
  pushed: boolean;
}

/**
 * SKILL: commit_changes
 *
 * WHAT IT DOES
 *   Stages changes, creates a commit on the current feature branch, and (by
 *   default) pushes that branch to GitHub using the connection's authenticated
 *   remote.
 *
 * WHEN AN AGENT SHOULD CALL IT
 *   After editing files on disk, once the work is ready to save. Must be run
 *   while a feature branch is checked out (call create_branch first). Typically
 *   the step right before open_pr.
 *
 * SAFETY (PR-only invariant)
 *   - Refuses to commit while HEAD is `main`/`master` → PROTECTED_BRANCH. If you
 *     hit this, you skipped create_branch; make a feature branch and retry.
 *   - Returns WORKING_TREE_CLEAN (not a crash) when there is nothing to commit.
 *
 * AUTHENTICATION
 *   Stateless. The push target comes from `connection.remoteUrl(repo)`; the token
 *   is supplied just-in-time and never handled by this tool. Any token that leaks
 *   into git stderr is redacted before being returned.
 *
 * @param connection   An authenticated GitHubConnection. Required.
 * @param params.dir   Path to the local clone. Required.
 * @param params.repo  "owner/name" — used only to build the authenticated push URL. Required.
 * @param params.message Commit message. Required.
 * @param params.paths Optional pathspecs to stage. Defaults to ["."] (all changes).
 * @param params.push  Optional. Push after committing. Defaults to true.
 *
 * @returns Result<CommitResult>
 *   ok:    { branch, sha, pushed }
 *   error: PROTECTED_BRANCH | WORKING_TREE_CLEAN | GIT_COMMAND_FAILED.
 *
 * @example
 *   await commitChanges(connection, {
 *     dir: "./work", repo: "octocat/hello-world", message: "fix: typo",
 *   });
 */
export async function commitChanges(
  connection: GitHubConnection,
  params: CommitParams,
): Promise<Result<CommitResult>> {
  const { dir, repo, message, paths = ["."], push = true } = params;

  // Guard 1: must be on a feature branch.
  const branchRes = await currentBranch(dir);
  if (isErr(branchRes)) return branchRes;
  const guard = assertCommittable(branchRes.data);
  if (isErr(guard)) return guard;
  const branch = branchRes.data;

  // Stage.
  const add = await runGit(["add", "--", ...paths], { cwd: dir });
  if (add.code !== 0) {
    return err(ErrorCode.GIT_COMMAND_FAILED, "git add failed.", {
      stderr: add.stderr.trim(),
    });
  }

  // Guard 2: nothing to commit is a no-op, not a crash.
  const status = await runGit(["status", "--porcelain"], { cwd: dir });
  if (status.code === 0 && status.stdout.trim() === "") {
    return err(ErrorCode.WORKING_TREE_CLEAN, "No staged changes to commit.");
  }

  // Commit.
  const commit = await runGit(["commit", "-m", message], { cwd: dir });
  if (commit.code !== 0) {
    return err(ErrorCode.GIT_COMMAND_FAILED, "git commit failed.", {
      stderr: commit.stderr.trim(),
    });
  }
  const shaRes = await runGit(["rev-parse", "HEAD"], { cwd: dir });
  const sha = shaRes.stdout.trim();

  if (!push) return ok({ branch, sha, pushed: false });

  // Push to the connection's authenticated remote. We push to an explicit URL
  // rather than a named remote so the token is supplied just-in-time.
  const pushRes = await runGit(
    ["push", connection.remoteUrl(repo), `HEAD:refs/heads/${branch}`],
    { cwd: dir },
  );
  if (pushRes.code !== 0) {
    return err(ErrorCode.GIT_COMMAND_FAILED, "git push failed.", {
      stderr: pushRes.stderr.replace(/x-access-token:[^@]+@/g, "x-access-token:***@").trim(),
    });
  }

  return ok({ branch, sha, pushed: true });
}
