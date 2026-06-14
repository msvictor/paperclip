/**
 * create_remote_branch — create a branch on GitHub directly, no clone needed.
 *
 * The Tech Lead's first move is to cut a `release` branch from `main`. Doing
 * that through a clone means an awkward empty-branch push; over the API it's a
 * single ref creation. This tool reads the tip of the source branch and creates
 * the new ref pointing at the same commit.
 */

import { assertNotProtected } from "./guards.js";
import { ErrorCode, isReleaseBranch, isVersionedReleaseBranch, extractReleaseVersion } from "../shared/errors.js";
import { ok, err, isErr, type Result } from "../shared/result.js";
import type { GitHubConnection } from "../connection/types.js";

export interface CreateRemoteBranchParams {
  repo: string;
  /** New branch name, e.g. "release" or "release/1.4". */
  name: string;
  /** Source branch to cut from. Defaults to the repo's default branch (main). */
  from?: string;
}

export interface CreateRemoteBranchResult {
  name: string;
  /** The commit the new branch points at. */
  sha: string;
  /** The source branch it was cut from. */
  from: string;
  /** The semantic version carried by the name, e.g. "v1.4.0" (null if not a release branch). */
  version: string | null;
}

/**
 * SKILL: create_remote_branch
 *
 * WHAT IT DOES
 *   Creates a new branch on GitHub from the tip of a source branch, via the API.
 *
 * WHEN AN AGENT SHOULD CALL IT
 *   Workflow step 1: the TL cuts a versioned release branch from `main`, e.g.
 *   `release/v1.4.0`. Also handy any time you need a branch to exist remotely
 *   without a working tree.
 *
 * VERSIONING
 *   A release branch must carry a vX.Y.Z version (release/v1.4.0, release-v2.0.0,
 *   release/v1.4.0-rc.1). That version is how you later document which release a
 *   feature shipped in, so an unversioned "release" is rejected with
 *   INVALID_ARGUMENT. Non-release branch names are unaffected.
 *
 * SAFETY
 *   Refuses to (re)create a branch literally named main/master → PROTECTED_BRANCH.
 *
 * AUTHENTICATION
 *   Stateless. Performed entirely through `connection.api()`.
 *
 * @returns Result<CreateRemoteBranchResult>
 *   ok:    { name, sha, from }
 *   error: PROTECTED_BRANCH (name is main/master) |
 *          API_REQUEST_FAILED (source missing, or branch already exists → 422).
 */
export async function createRemoteBranch(
  connection: GitHubConnection,
  params: CreateRemoteBranchParams,
): Promise<Result<CreateRemoteBranchResult>> {
  const { repo, name } = params;

  const guard = assertNotProtected(name);
  if (isErr(guard)) return guard;

  // A release branch must be versioned — the version is what records which
  // release a feature lands in. Reject "release" / "release/foo" without vX.Y.Z.
  if (isReleaseBranch(name) && !isVersionedReleaseBranch(name)) {
    return err(
      ErrorCode.INVALID_ARGUMENT,
      `Release branches must carry a semantic version, e.g. "release/v1.4.0" (got "${name}"). ` +
        `The version documents which release features ship in.`,
      { name },
    );
  }

  // Resolve the source branch (default to the repo's default branch).
  let from = params.from;
  if (!from) {
    const meta = await connection.api<{ default_branch: string }>("GET", `/repos/${repo}`);
    if (!meta.ok) {
      return err(ErrorCode.API_REQUEST_FAILED, `Could not read ${repo} (${meta.status}).`);
    }
    from = meta.body.default_branch;
  }

  // Get the tip commit of the source branch.
  const ref = await connection.api<{
    object: { sha: string };
    message?: string;
  }>("GET", `/repos/${repo}/git/ref/heads/${encodeURIComponent(from)}`);
  if (!ref.ok) {
    return err(
      ErrorCode.API_REQUEST_FAILED,
      ref.body?.message ?? `Could not read branch "${from}" in ${repo} (${ref.status}).`,
      { status: ref.status },
    );
  }
  const sha = ref.body.object.sha;

  // Create the new ref pointing at that commit.
  const created = await connection.api<{
    ref: string;
    message?: string;
  }>("POST", `/repos/${repo}/git/refs`, {
    ref: `refs/heads/${name}`,
    sha,
  });
  if (!created.ok) {
    return err(
      ErrorCode.API_REQUEST_FAILED,
      created.body?.message ?? `Could not create branch "${name}" in ${repo} (${created.status}).`,
      { status: created.status },
    );
  }

  return ok({ name, sha, from, version: extractReleaseVersion(name) });
}
