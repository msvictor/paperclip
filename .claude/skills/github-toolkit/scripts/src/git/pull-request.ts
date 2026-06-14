/**
 * open_pr — open a Pull Request from a feature branch.
 *
 * Pure API operation, performed entirely through the connection's `api()` helper.
 * Refuses a protected branch as the head, preserving the PR-only invariant.
 */

import { assertNotProtected } from "./guards.js";
import { ErrorCode } from "../shared/errors.js";
import { ok, err, isErr, type Result } from "../shared/result.js";
import type { GitHubConnection } from "../connection/types.js";

export interface OpenPrParams {
  repo: string;
  /** Source branch (the feature branch). */
  head: string;
  /** Target branch. Defaults to the repo's default branch. */
  base?: string;
  title: string;
  body?: string;
  /** Open as a draft PR. */
  draft?: boolean;
}

export interface OpenPrResult {
  number: number;
  url: string;
  state: string;
}

/**
 * SKILL: open_pr
 *
 * WHAT IT DOES
 *   Opens a Pull Request from a feature branch into a base branch via the GitHub
 *   REST API, returning the new PR's number and URL.
 *
 * WHEN AN AGENT SHOULD CALL IT
 *   The final step of the "change a repository" workflow, after commit_changes
 *   has pushed the feature branch. This is the only way changes become reviewable
 *   — there is deliberately no merge tool.
 *
 * SAFETY (PR-only invariant)
 *   Refuses a protected branch (`main`/`master`) as the PR head → PROTECTED_BRANCH.
 *   The head must be a feature branch.
 *
 * AUTHENTICATION
 *   Stateless. Performed entirely through `connection.api()`; no token handling.
 *
 * @param connection   An authenticated GitHubConnection. Required.
 * @param params.repo  "owner/name". Required.
 * @param params.head  Source feature branch. Required. Must not be main/master.
 * @param params.base  Target branch. Optional — defaults to the repo's default branch.
 * @param params.title PR title. Required.
 * @param params.body  Optional PR description (Markdown).
 * @param params.draft Optional. Open as a draft PR. Defaults to false.
 *
 * @returns Result<OpenPrResult>
 *   ok:    { number, url, state }
 *   error: PROTECTED_BRANCH | API_REQUEST_FAILED (e.g. no diff, PR already exists).
 *
 * @example
 *   await openPr(connection, {
 *     repo: "octocat/hello-world", head: "fix/typo", title: "Fix typo",
 *   });
 */
export async function openPr(
  connection: GitHubConnection,
  params: OpenPrParams,
): Promise<Result<OpenPrResult>> {
  const { repo, head, title, body, draft } = params;

  const guard = assertNotProtected(head);
  if (isErr(guard)) return guard;

  // Resolve base lazily so callers don't have to know the default branch.
  let base = params.base;
  if (!base) {
    const meta = await connection.api<{ default_branch: string }>(
      "GET",
      `/repos/${repo}`,
    );
    if (!meta.ok) {
      return err(ErrorCode.API_REQUEST_FAILED, `Could not read ${repo} (${meta.status}).`);
    }
    base = meta.body.default_branch;
  }

  const res = await connection.api<{
    number: number;
    html_url: string;
    state: string;
    message?: string;
  }>("POST", `/repos/${repo}/pulls`, { title, head, base, body, draft });

  if (!res.ok) {
    return err(ErrorCode.API_REQUEST_FAILED, res.body?.message ?? `GitHub returned ${res.status}.`, {
      status: res.status,
    });
  }

  return ok({ number: res.body.number, url: res.body.html_url, state: res.body.state });
}
