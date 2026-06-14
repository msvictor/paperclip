/**
 * Pull Request review tools — inspect a PR and leave feedback.
 *
 * Every function here is a pure API operation through `connection.api()`. None
 * of them mutate a working tree or touch the protected-branch rule: reviewing
 * and commenting are always safe, because they never write code to a branch.
 * They round out the read/change/review surface of the toolkit.
 */

import { ErrorCode } from "../shared/errors.js";
import { ok, err, type Result } from "../shared/result.js";
import type { GitHubConnection } from "../connection/types.js";

export interface GetPrParams {
  /** "owner/name". */
  repo: string;
  /** PR number. */
  number: number;
}

export interface GetPrResult {
  number: number;
  title: string;
  state: string;
  /** "owner:branch" or "branch" — the source. */
  head: string;
  /** The target branch. */
  base: string;
  body: string;
  url: string;
  /** Login of the PR author. */
  author: string;
  merged: boolean;
  draft: boolean;
}

/**
 * SKILL: get_pr
 *
 * WHAT IT DOES
 *   Fetches a Pull Request's metadata (title, state, head/base, author, body).
 *
 * WHEN AN AGENT SHOULD CALL IT
 *   First, when asked to review or report on a PR — to orient before reading the
 *   diff. Pair it with list_pr_files to see what actually changed.
 *
 * AUTHENTICATION
 *   Stateless. Performed entirely through `connection.api()`.
 *
 * @returns Result<GetPrResult>
 *   error: API_REQUEST_FAILED (e.g. PR not found).
 */
export async function getPr(
  connection: GitHubConnection,
  params: GetPrParams,
): Promise<Result<GetPrResult>> {
  const { repo, number } = params;
  const res = await connection.api<{
    number: number;
    title: string;
    state: string;
    body: string | null;
    html_url: string;
    merged: boolean;
    draft: boolean;
    user: { login: string };
    head: { label: string };
    base: { ref: string };
    message?: string;
  }>("GET", `/repos/${repo}/pulls/${number}`);

  if (!res.ok) {
    return err(
      ErrorCode.API_REQUEST_FAILED,
      res.body?.message ?? `Could not read PR #${number} in ${repo} (${res.status}).`,
      { status: res.status },
    );
  }

  const b = res.body;
  return ok({
    number: b.number,
    title: b.title,
    state: b.state,
    head: b.head.label,
    base: b.base.ref,
    body: b.body ?? "",
    url: b.html_url,
    author: b.user.login,
    merged: b.merged,
    draft: b.draft,
  });
}

export interface ListPrFilesParams {
  repo: string;
  number: number;
}

export interface PrFile {
  filename: string;
  /** "added" | "modified" | "removed" | "renamed". */
  status: string;
  additions: number;
  deletions: number;
  /** Unified diff hunk for this file. May be absent for very large/binary files. */
  patch?: string;
}

export interface ListPrFilesResult {
  number: number;
  files: PrFile[];
}

/**
 * SKILL: list_pr_files
 *
 * WHAT IT DOES
 *   Lists the files changed in a PR with per-file status, line counts, and the
 *   unified diff (`patch`) for each — i.e. the reviewable diff.
 *
 * WHEN AN AGENT SHOULD CALL IT
 *   To read what a PR actually changes before writing a review. The `patch`
 *   field is the diff you reason over; the `line` numbers you cite in
 *   review_pr comments refer to lines in these diffs.
 *
 * AUTHENTICATION
 *   Stateless. Performed entirely through `connection.api()`.
 *
 * @returns Result<ListPrFilesResult>
 *   error: API_REQUEST_FAILED.
 */
export async function listPrFiles(
  connection: GitHubConnection,
  params: ListPrFilesParams,
): Promise<Result<ListPrFilesResult>> {
  const { repo, number } = params;
  // 100 per page is the API max; sufficient for typical PRs.
  const res = await connection.api<
    Array<{
      filename: string;
      status: string;
      additions: number;
      deletions: number;
      patch?: string;
    }>
  >("GET", `/repos/${repo}/pulls/${number}/files?per_page=100`);

  if (!res.ok) {
    return err(
      ErrorCode.API_REQUEST_FAILED,
      `Could not list files for PR #${number} in ${repo} (${res.status}).`,
      { status: res.status },
    );
  }

  const files = res.body.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));
  return ok({ number, files });
}

/** A single inline (line-level) review comment. */
export interface ReviewComment {
  /** File path, exactly as it appears in the diff. */
  path: string;
  /** Line number in the file's NEW version (the right side of the diff). */
  line: number;
  /** The comment text (Markdown). */
  body: string;
}

export type ReviewEvent = "COMMENT" | "APPROVE" | "REQUEST_CHANGES";

export interface ReviewPrParams {
  repo: string;
  number: number;
  /**
   * The verdict. COMMENT leaves feedback without approving; APPROVE signs off;
   * REQUEST_CHANGES blocks until addressed. Default COMMENT — the safe choice
   * when you're unsure, since it never approves code on the user's behalf.
   */
  event?: ReviewEvent;
  /** Overall review summary (Markdown). */
  body?: string;
  /** Optional inline comments anchored to specific diff lines. */
  comments?: ReviewComment[];
}

export interface ReviewPrResult {
  id: number;
  state: string;
  url: string;
}

/**
 * SKILL: review_pr
 *
 * WHAT IT DOES
 *   Submits a single Pull Request review: an overall summary plus any number of
 *   inline comments anchored to specific lines, with a verdict (COMMENT,
 *   APPROVE, or REQUEST_CHANGES).
 *
 * WHEN AN AGENT SHOULD CALL IT
 *   After reading the diff with list_pr_files. Bundle all your feedback into one
 *   review rather than many scattered comments. Default to event: "COMMENT" —
 *   only APPROVE or REQUEST_CHANGES when the user explicitly wants a verdict,
 *   since approving merges responsibility onto the human.
 *
 * SAFETY
 *   This never writes code and never targets a branch, so the protected-branch
 *   rule doesn't apply. It also has no merge capability — reviewing a PR can't
 *   land it.
 *
 * AUTHENTICATION
 *   Stateless. Performed entirely through `connection.api()`.
 *
 * @returns Result<ReviewPrResult>
 *   error: API_REQUEST_FAILED (e.g. a comment line isn't part of the diff,
 *          or you tried to approve your own PR).
 */
export async function reviewPr(
  connection: GitHubConnection,
  params: ReviewPrParams,
): Promise<Result<ReviewPrResult>> {
  const { repo, number, event = "COMMENT", body, comments } = params;

  const payload: Record<string, unknown> = { event };
  if (body) payload.body = body;
  if (comments?.length) {
    // The reviews API wants { path, line, body, side } per comment. We anchor to
    // the new version of the file (RIGHT side), which is what `line` means here.
    payload.comments = comments.map((c) => ({
      path: c.path,
      line: c.line,
      side: "RIGHT",
      body: c.body,
    }));
  }

  const res = await connection.api<{
    id: number;
    state: string;
    html_url: string;
    message?: string;
  }>("POST", `/repos/${repo}/pulls/${number}/reviews`, payload);

  if (!res.ok) {
    return err(
      ErrorCode.API_REQUEST_FAILED,
      res.body?.message ?? `Could not submit review on PR #${number} (${res.status}).`,
      { status: res.status },
    );
  }
  return ok({ id: res.body.id, state: res.body.state, url: res.body.html_url });
}

export interface CommentOnPrParams {
  repo: string;
  number: number;
  /** The comment text (Markdown). */
  body: string;
}

export interface CommentOnPrResult {
  id: number;
  url: string;
}

/**
 * SKILL: comment_on_pr
 *
 * WHAT IT DOES
 *   Posts a single top-level (conversation) comment on a PR — the kind that
 *   isn't tied to a line of the diff.
 *
 * WHEN AN AGENT SHOULD CALL IT
 *   For a quick note, question, or status update on a PR when you don't need a
 *   formal review verdict or line anchoring. For substantive line-by-line
 *   feedback, prefer review_pr.
 *
 * AUTHENTICATION
 *   Stateless. Performed entirely through `connection.api()`.
 *
 * @returns Result<CommentOnPrResult>
 *   error: API_REQUEST_FAILED.
 */
export async function commentOnPr(
  connection: GitHubConnection,
  params: CommentOnPrParams,
): Promise<Result<CommentOnPrResult>> {
  const { repo, number, body } = params;
  // PR conversation comments use the Issues comments endpoint (a PR is an issue).
  const res = await connection.api<{
    id: number;
    html_url: string;
    message?: string;
  }>("POST", `/repos/${repo}/issues/${number}/comments`, { body });

  if (!res.ok) {
    return err(
      ErrorCode.API_REQUEST_FAILED,
      res.body?.message ?? `Could not comment on PR #${number} (${res.status}).`,
      { status: res.status },
    );
  }
  return ok({ id: res.body.id, url: res.body.html_url });
}
