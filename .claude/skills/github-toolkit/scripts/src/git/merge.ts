/**
 * merge_pr — merge an approved Pull Request, with a code-level hard stop.
 *
 * This is the one tool that lands changes, so it carries the workflow's most
 * important guard. It looks up the PR's BASE branch and refuses outright if that
 * base is a default branch (main/master): merging the release PR into main is a
 * human-only action. Merging feature PRs INTO a release branch is allowed — that
 * is the TL's normal integration step.
 *
 * The guard lives here in code, not in a prompt, so no instruction can talk the
 * tool into merging onto main.
 */

import { assertMergeableInto } from "./guards.js";
import { ErrorCode, extractReleaseVersion } from "../shared/errors.js";
import { ok, err, isErr, type Result } from "../shared/result.js";
import type { GitHubConnection } from "../connection/types.js";

export type MergeMethod = "merge" | "squash" | "rebase";

export interface MergePrParams {
  repo: string;
  number: number;
  /** How to merge. Defaults to "merge" (a merge commit). */
  method?: MergeMethod;
  /** Optional commit title/message for squash or merge-commit strategies. */
  commitTitle?: string;
  commitMessage?: string;
  /**
   * When merging into a versioned release branch, leave a comment on the PR
   * recording which version it shipped in (e.g. "Merged into release v1.4.0").
   * This is how a feature's release version gets documented. Defaults to true;
   * set false to stay silent. Best-effort — a failed comment never fails the merge.
   */
  recordReleaseVersion?: boolean;
}

export interface MergePrResult {
  merged: boolean;
  /** SHA of the resulting merge commit. */
  sha: string;
  /** The branch the PR was merged into. */
  base: string;
  /** The version the feature shipped in, if base was a versioned release branch. */
  releaseVersion: string | null;
  /** Whether a "merged into <version>" note was successfully left on the PR. */
  versionRecorded: boolean;
}

/**
 * SKILL: merge_pr
 *
 * WHAT IT DOES
 *   Merges an open PR via the GitHub API — but only if its base is a safe target.
 *
 * WHEN AN AGENT SHOULD CALL IT
 *   To integrate an approved feature PR INTO a release branch (workflow step 4).
 *   Review and approve it first with review_pr. Do NOT call it on the release→main
 *   PR — that one is for a human to merge.
 *
 * THE HARD STOP
 *   If the PR's base is main or master, this returns PROTECTED_BRANCH and merges
 *   nothing. That's intentional and not an error to route around: approve the
 *   release PR and tell the user a human must click merge.
 *
 * RECORDING THE VERSION
 *   When the base is a versioned release branch (release/v1.4.0), this leaves a
 *   note on the PR — "✅ Merged into release `v1.4.0`" — so the feature's release
 *   version is documented in the PR thread. Pass recordReleaseVersion: false to
 *   skip it. The note is best-effort and never fails the merge.
 *
 * AUTHENTICATION
 *   Stateless. Performed entirely through `connection.api()`.
 *
 * @returns Result<MergePrResult>
 *   ok:    { merged, sha, base, releaseVersion, versionRecorded }
 *   error: PROTECTED_BRANCH (base is main/master — human-only) |
 *          API_REQUEST_FAILED (not mergeable: conflicts, not approved under branch
 *          protection, already merged, etc.).
 */
export async function mergePr(
  connection: GitHubConnection,
  params: MergePrParams,
): Promise<Result<MergePrResult>> {
  const { repo, number, method = "merge", commitTitle, commitMessage,
    recordReleaseVersion = true } = params;

  // Find out where this PR would land before doing anything.
  const pr = await connection.api<{
    base: { ref: string };
    message?: string;
  }>("GET", `/repos/${repo}/pulls/${number}`);
  if (!pr.ok) {
    return err(
      ErrorCode.API_REQUEST_FAILED,
      pr.body?.message ?? `Could not read PR #${number} in ${repo} (${pr.status}).`,
      { status: pr.status },
    );
  }

  const base = pr.body.base.ref;

  // The hard stop: never merge onto a default branch.
  const guard = assertMergeableInto(base);
  if (isErr(guard)) return guard;

  const res = await connection.api<{
    merged: boolean;
    sha: string;
    message?: string;
  }>("PUT", `/repos/${repo}/pulls/${number}/merge`, {
    merge_method: method,
    commit_title: commitTitle,
    commit_message: commitMessage,
  });

  if (!res.ok) {
    return err(
      ErrorCode.API_REQUEST_FAILED,
      res.body?.message ?? `Could not merge PR #${number} into ${base} (${res.status}).`,
      { status: res.status, base },
    );
  }

  // Document which release the feature shipped in by noting it on the PR.
  const releaseVersion = extractReleaseVersion(base);
  let versionRecorded = false;
  if (releaseVersion && recordReleaseVersion) {
    const note = await connection.api(
      "POST",
      `/repos/${repo}/issues/${number}/comments`,
      { body: `✅ Merged into release \`${releaseVersion}\` — this feature ships in ${releaseVersion}.` },
    );
    versionRecorded = note.ok;
  }

  return ok({ merged: res.body.merged, sha: res.body.sha, base, releaseVersion, versionRecorded });
}
