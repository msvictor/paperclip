/**
 * github-connection-agent
 * ------------------------
 * SOLE RESPONSIBILITY: authenticate to GitHub and hold the connection state.
 *
 * This module is the only place in the system that:
 *   - reads the credential from the environment,
 *   - validates it against GitHub,
 *   - stores the token, and
 *   - knows how to attach it to an outbound request.
 *
 * It performs NO git operations and NO repository mutations. It hands back a
 * `GitHubConnection` capability object that the git tools consume. If you ever
 * change *how* you authenticate, this is the only file you touch.
 */

import { httpJson, type HttpJsonResult } from "../shared/exec.js";
import { ErrorCode } from "../shared/errors.js";
import { ok, err, type Result } from "../shared/result.js";
import type { GitHubConnection, GitHubIdentity } from "./types.js";

const DEFAULT_API_BASE = "https://api.github.com";
const TOKEN_ENV_VAR = "GITHUB_TOKEN";

export interface ConnectOptions {
  /** Override the credential source. Defaults to process.env.GITHUB_TOKEN. */
  token?: string;
  /** Override the API base (GitHub Enterprise Server). */
  apiBaseUrl?: string;
  /** Scopes the caller requires up front; connect() fails fast if any are missing. */
  requiredScopes?: string[];
}

/**
 * Concrete connection. The class body is private to this module — callers only
 * ever see it through the `GitHubConnection` interface, which deliberately does
 * not expose the raw token.
 */
class Connection implements GitHubConnection {
  readonly identity: GitHubIdentity;
  readonly apiBaseUrl: string;
  // Private: the secret lives here and nowhere else.
  readonly #token: string;

  constructor(token: string, apiBaseUrl: string, identity: GitHubIdentity) {
    this.#token = token;
    this.apiBaseUrl = apiBaseUrl;
    this.identity = identity;
  }

  #headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.#token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "github-connection-agent",
      ...extra,
    };
  }

  async api<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<HttpJsonResult<T>> {
    const url = path.startsWith("http") ? path : `${this.apiBaseUrl}${path}`;
    return httpJson<T>(url, {
      method,
      headers: this.#headers(
        body ? { "Content-Type": "application/json" } : {},
      ),
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  remoteUrl(repo: string): string {
    // x-access-token is GitHub's convention for token-in-URL auth over HTTPS.
    return `https://x-access-token:${this.#token}@github.com/${repo}.git`;
  }

  hasScope(scope: string): boolean {
    return this.identity.scopes.includes(scope);
  }
}

/**
 * Authenticate and return a live connection.
 *
 * Steps: resolve token -> call GET /user to validate -> capture identity and
 * granted scopes -> optionally enforce required scopes.
 */
export async function connect(
  options: ConnectOptions = {},
): Promise<Result<GitHubConnection>> {
  const token = options.token ?? process.env[TOKEN_ENV_VAR];
  const apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE;

  if (!token) {
    return err(
      ErrorCode.MISSING_TOKEN,
      `No credential found. Set ${TOKEN_ENV_VAR} in the environment.`,
    );
  }

  // Validate by calling /user. A 401 means a bad/expired token.
  let res: HttpJsonResult<{ login: string; id: number }>;
  try {
    res = await httpJson(`${apiBaseUrl}/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "github-connection-agent",
      },
    });
  } catch (e) {
    return err(ErrorCode.API_REQUEST_FAILED, "Could not reach GitHub.", {
      cause: (e as Error).message,
    });
  }

  if (res.status === 401) {
    return err(ErrorCode.INVALID_TOKEN, "The token was rejected by GitHub (401).");
  }
  if (!res.ok) {
    return err(ErrorCode.API_REQUEST_FAILED, `GitHub returned ${res.status}.`);
  }

  // Scopes for classic PATs come back in this header; empty for fine-grained
  // tokens (where permissions are enforced server-side instead).
  const scopes = (res.headers.get("x-oauth-scopes") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const identity: GitHubIdentity = {
    login: res.body.login,
    id: res.body.id,
    scopes,
  };

  // Fail fast if the caller declared scopes the token doesn't have. (Skipped
  // when scopes is empty, i.e. a fine-grained token.)
  if (options.requiredScopes?.length && scopes.length) {
    const missing = options.requiredScopes.filter((s) => !scopes.includes(s));
    if (missing.length) {
      return err(
        ErrorCode.INSUFFICIENT_SCOPE,
        `Token is missing required scope(s): ${missing.join(", ")}.`,
        { missing, granted: scopes },
      );
    }
  }

  return ok(new Connection(token, apiBaseUrl, identity));
}

/**
 * Re-validate an existing connection (e.g. before a long operation). Returns the
 * same connection on success so callers can chain.
 */
export async function verify(
  connection: GitHubConnection,
): Promise<Result<GitHubConnection>> {
  const res = await connection.api("GET", "/user");
  if (res.status === 401) {
    return err(ErrorCode.INVALID_TOKEN, "Connection is no longer valid (401).");
  }
  if (!res.ok) {
    return err(ErrorCode.API_REQUEST_FAILED, `GitHub returned ${res.status}.`);
  }
  return ok(connection);
}
