/**
 * github-toolkit — top-level entry point.
 *
 * Two layers, one dependency direction:
 *
 *     connection/  (owns auth + the token)   <───┐
 *         │ produces a GitHubConnection           │ git tools depend on the
 *         ▼                                        │ connection INTERFACE only
 *     git/         (stateless operations)  ────────┘
 *
 * The git tools never import the connection agent's implementation — only the
 * `GitHubConnection` type. That is what makes the auth backend swappable.
 */
export * as connection from "./connection/index.js";
export * as git from "./git/index.js";
export type { GitHubConnection } from "./connection/types.js";
export { ok, err, isOk, isErr, type Result } from "./shared/result.js";
export { ErrorCode } from "./shared/errors.js";
