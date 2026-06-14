/**
 * create_branch — create and check out a new feature branch.
 *
 * Pure git-local operation. It takes a connection for signature symmetry with
 * the other tools (and so a future implementation could, say, check branch
 * protection rules via the API) but does not currently need the network.
 */

import { runGit } from "../shared/exec.js";
import { assertNotProtected } from "./guards.js";
import { ErrorCode } from "../shared/errors.js";
import { ok, err, isErr, type Result } from "../shared/result.js";
import type { GitHubConnection } from "../connection/types.js";

export interface CreateBranchParams {
  dir: string;
  /** New branch name, e.g. "fix/login-typo". */
  name: string;
  /** Branch/ref to start from. Defaults to current HEAD. */
  from?: string;
}

export interface CreateBranchResult {
  dir: string;
  branch: string;
}

/**
 * SKILL: create_branch
 *
 * WHAT IT DOES
 *   Creates a new feature branch and checks it out in an existing local clone.
 *
 * WHEN AN AGENT SHOULD CALL IT
 *   Immediately after cloning and BEFORE editing any files. Every change must
 *   land on a feature branch — this is what makes the later commit/PR legal
 *   under the PR-only rule. Name the branch for the task, e.g. "fix/login-typo",
 *   "feat/oauth", "chore/bump-deps".
 *
 * SAFETY
 *   Refuses to create a branch literally named `main` or `master`
 *   (PROTECTED_BRANCH), so the agent can't accidentally clobber a default branch.
 *
 * AUTHENTICATION
 *   Stateless and currently offline (pure git). Takes the connection for
 *   signature symmetry and future API-based checks; does not use it today.
 *
 * @param connection  An authenticated GitHubConnection (unused for now).
 * @param params.dir   Path to the local clone. Required.
 * @param params.name  New branch name, e.g. "fix/login-typo". Required. Must not
 *                     be a protected branch name.
 * @param params.from  Optional start point (branch, tag, or SHA). Defaults to HEAD.
 *
 * @returns Result<CreateBranchResult>
 *   ok:    { dir, branch }
 *   error: PROTECTED_BRANCH (name is main/master) | GIT_COMMAND_FAILED.
 *
 * @example
 *   await createBranch(connection, { dir: "./work", name: "fix/typo" });
 */
export async function createBranch(
  _connection: GitHubConnection,
  params: CreateBranchParams,
): Promise<Result<CreateBranchResult>> {
  const { dir, name, from } = params;

  // Don't let callers "create" a protected branch name as their work branch.
  const guard = assertNotProtected(name);
  if (isErr(guard)) return guard;

  const args = ["checkout", "-b", name];
  if (from) args.push(from);

  const r = await runGit(args, { cwd: dir });
  if (r.code !== 0) {
    return err(ErrorCode.GIT_COMMAND_FAILED, `Could not create branch "${name}".`, {
      stderr: r.stderr.trim(),
    });
  }
  return ok({ dir, branch: name });
}
