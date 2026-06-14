/**
 * Central catalogue of error codes.
 *
 * Codes are grouped by the module that owns them so it stays obvious which
 * layer a failure came from. The auth codes live only in the connection agent;
 * the git codes live only in the git tools. This separation is intentional —
 * a git tool should never raise an AUTH_* code, because it doesn't do auth.
 */

export const ErrorCode = {
  // --- Connection agent (auth) ---
  MISSING_TOKEN: "MISSING_TOKEN",
  INVALID_TOKEN: "INVALID_TOKEN",
  INSUFFICIENT_SCOPE: "INSUFFICIENT_SCOPE",
  NOT_CONNECTED: "NOT_CONNECTED",

  // --- Git tools ---
  PROTECTED_BRANCH: "PROTECTED_BRANCH",
  GIT_COMMAND_FAILED: "GIT_COMMAND_FAILED",
  API_REQUEST_FAILED: "API_REQUEST_FAILED",
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  WORKING_TREE_CLEAN: "WORKING_TREE_CLEAN",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Default branches we will never commit to, push to, target as a PR head, or
 * merge a PR INTO. Merging onto these is the human-only "hard stop" of the
 * release workflow.
 */
export const PROTECTED_BRANCHES = new Set(["main", "master"]);

/**
 * Recognise release branches: exactly "release", or "release/x" / "release-x"
 * (e.g. "release/1.4", "release-2025-06"). These are integration branches —
 * code lands on them only through a reviewed PR, never a direct commit — but,
 * unlike main/master, a PR MAY be merged into them automatically.
 */
export const RELEASE_BRANCH_PATTERN = /^release(?:[/-].*)?$/;

export function isReleaseBranch(branch: string): boolean {
  return RELEASE_BRANCH_PATTERN.test(branch);
}

/**
 * The required shape of a release branch: a semantic version with a "v" prefix,
 * e.g. "release/v1.4.0" or "release-v2.0.0". An optional pre-release/build
 * suffix is allowed ("release/v1.4.0-rc.1"). The captured version is what
 * documents *which* release a feature landed in, so we standardise on it.
 */
export const RELEASE_VERSION_PATTERN =
  /^release[/-](v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/;

/** Pull the version (e.g. "v1.4.0") out of a release branch name, or null. */
export function extractReleaseVersion(branch: string): string | null {
  const m = branch.match(RELEASE_VERSION_PATTERN);
  return m ? m[1] : null;
}

/** True only for release branches that carry a valid vX.Y.Z version. */
export function isVersionedReleaseBranch(branch: string): boolean {
  return extractReleaseVersion(branch) !== null;
}
