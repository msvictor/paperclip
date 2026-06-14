/**
 * Read-only repository tools — inspect a repo without cloning or changing it.
 *
 * Both operate entirely through the connection's authenticated `api()` helper,
 * so they need no working tree and touch no credentials. Reach for these when a
 * task only needs to *look* at a repository; clone instead when you need the
 * full working tree on disk (e.g. to build, run tests, or edit many files).
 */

import { ErrorCode } from "../shared/errors.js";
import { ok, err, type Result } from "../shared/result.js";
import type { GitHubConnection } from "../connection/types.js";

export interface ReadFileParams {
  /** "owner/name". */
  repo: string;
  /** Path to the file within the repo, e.g. "src/index.ts". */
  path: string;
  /** Branch, tag, or SHA to read from. Defaults to the repo's default branch. */
  ref?: string;
}

export interface ReadFileResult {
  path: string;
  /** Decoded UTF-8 file contents. */
  content: string;
  /** The blob SHA — useful if you later need to update the file via the API. */
  sha: string;
}

/**
 * SKILL: read_file
 *
 * WHAT IT DOES
 *   Reads a single file's contents from a GitHub repository over the REST API,
 *   with no clone required.
 *
 * WHEN AN AGENT SHOULD CALL IT
 *   When you need to see one or a handful of files and aren't going to change
 *   them. It's faster than cloning. If you need many files, the whole tree, or
 *   to run/build the code, clone instead.
 *
 * AUTHENTICATION
 *   Stateless. Performed entirely through `connection.api()`.
 *
 * @returns Result<ReadFileResult>
 *   ok:    { path, content, sha }
 *   error: API_REQUEST_FAILED (not found) | INVALID_ARGUMENT (path is a directory).
 */
export async function readFile(
  connection: GitHubConnection,
  params: ReadFileParams,
): Promise<Result<ReadFileResult>> {
  const { repo, path, ref } = params;
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const res = await connection.api<{
    type: string;
    content?: string;
    encoding?: string;
    sha: string;
    message?: string;
  }>("GET", `/repos/${repo}/contents/${path}${query}`);

  if (!res.ok) {
    return err(
      ErrorCode.API_REQUEST_FAILED,
      res.body?.message ?? `Could not read ${path} from ${repo} (${res.status}).`,
      { status: res.status },
    );
  }
  if (res.body.type !== "file" || res.body.content === undefined) {
    return err(
      ErrorCode.INVALID_ARGUMENT,
      `"${path}" is not a file (type: ${res.body.type}). Use list_tree to browse directories.`,
    );
  }

  // The contents API returns base64 with embedded newlines.
  const content = Buffer.from(res.body.content, "base64").toString("utf8");
  return ok({ path, content, sha: res.body.sha });
}

export interface ListTreeParams {
  /** "owner/name". */
  repo: string;
  /** Branch, tag, or SHA. Defaults to the repo's default branch. */
  ref?: string;
  /** Recurse into all subdirectories. Defaults to false (top level only). */
  recursive?: boolean;
}

export interface TreeEntry {
  path: string;
  /** "blob" (file) or "tree" (directory). */
  type: string;
}

export interface ListTreeResult {
  ref: string;
  entries: TreeEntry[];
  /** True if GitHub truncated the listing (very large repos). */
  truncated: boolean;
}

/**
 * SKILL: list_tree
 *
 * WHAT IT DOES
 *   Lists the files and directories in a repository over the REST API, without
 *   cloning. Top level by default; pass recursive to get the whole tree.
 *
 * WHEN AN AGENT SHOULD CALL IT
 *   To discover what's in a repo or find a file's path before reading it.
 *
 * AUTHENTICATION
 *   Stateless. Performed entirely through `connection.api()`.
 *
 * @returns Result<ListTreeResult>
 *   ok:    { ref, entries, truncated }
 *   error: API_REQUEST_FAILED.
 */
export async function listTree(
  connection: GitHubConnection,
  params: ListTreeParams,
): Promise<Result<ListTreeResult>> {
  const { repo, recursive } = params;

  // Resolve the ref to a tree. Default to the repo's default branch.
  let ref = params.ref;
  if (!ref) {
    const meta = await connection.api<{ default_branch: string }>("GET", `/repos/${repo}`);
    if (!meta.ok) {
      return err(ErrorCode.API_REQUEST_FAILED, `Could not read ${repo} (${meta.status}).`);
    }
    ref = meta.body.default_branch;
  }

  const query = recursive ? "?recursive=1" : "";
  const res = await connection.api<{
    tree: Array<{ path: string; type: string }>;
    truncated: boolean;
    message?: string;
  }>("GET", `/repos/${repo}/git/trees/${encodeURIComponent(ref)}${query}`);

  if (!res.ok) {
    return err(
      ErrorCode.API_REQUEST_FAILED,
      res.body?.message ?? `Could not list ${repo}@${ref} (${res.status}).`,
      { status: res.status },
    );
  }

  const entries = res.body.tree.map((e) => ({ path: e.path, type: e.type }));
  return ok({ ref, entries, truncated: res.body.truncated });
}
