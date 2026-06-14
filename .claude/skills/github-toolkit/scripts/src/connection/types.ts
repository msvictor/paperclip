/**
 * The connection contract.
 *
 * `GitHubConnection` is the *only* thing the git tools accept. It is a capability
 * object: it exposes what a tool is allowed to do (make authed API calls, build
 * an authed remote URL, read identity metadata) without handing the raw token
 * around the codebase. The token is captured once, inside the connection, and
 * never re-read from the environment by anyone else.
 *
 * Because the git tools depend on this interface rather than on the agent's
 * concrete implementation, you can swap the auth backend (PAT today, GitHub App
 * installation token or OAuth tomorrow) without touching a single git tool.
 */

import type { HttpJsonResult } from "../shared/exec.js";

export interface GitHubIdentity {
  /** The authenticated account's login, e.g. "octocat". */
  login: string;
  /** Numeric user id. */
  id: number;
  /** OAuth scopes granted to the token (from the X-OAuth-Scopes header). */
  scopes: string[];
}

export interface GitHubConnection {
  /** Who we are authenticated as. Read-only snapshot taken at connect time. */
  readonly identity: GitHubIdentity;

  /** REST API base, e.g. "https://api.github.com" (overridable for Enterprise). */
  readonly apiBaseUrl: string;

  /**
   * Make an authenticated REST call. Path is relative to `apiBaseUrl`
   * (e.g. "/repos/owner/name/pulls"). The connection injects auth + standard
   * headers; the caller never touches the token.
   */
  api<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<HttpJsonResult<T>>;

  /**
   * Build an authenticated HTTPS remote URL for `owner/name` so a git tool can
   * clone or push without ever seeing the token. The token is embedded here,
   * inside the connection, on purpose.
   */
  remoteUrl(repo: string): string;

  /** True if the token carries at least the given OAuth scope. */
  hasScope(scope: string): boolean;
}
