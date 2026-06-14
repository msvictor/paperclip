/**
 * Branch-safety guards shared by the git tools.
 *
 * The original toolkit had a single rule: never write to main/master. The
 * release-branching workflow adds a second axis, so we now distinguish two
 * different questions a tool might ask about a branch:
 *
 *   1. "May I COMMIT directly here?"  -> no for main, master, and any release
 *      branch. All code must arrive on those via a reviewed PR, never a direct
 *      commit. (assertCommittable)
 *
 *   2. "May I MERGE a PR INTO here?"  -> yes for release (that's the whole point
 *      of the flow), but never for main/master. Landing on main is the one
 *      action a human must take by hand — the hard stop. (assertMergeableInto)
 *
 * Keeping these as separate predicates is what lets the same `release` branch be
 * both un-committable (axis 1) and a valid merge target (axis 2) at once.
 */

import { runGit } from "../shared/exec.js";
import { PROTECTED_BRANCHES, isReleaseBranch, ErrorCode } from "../shared/errors.js";
import { ok, err, type Result } from "../shared/result.js";

/** Return the currently checked-out branch name in `dir`. */
export async function currentBranch(dir: string): Promise<Result<string>> {
  const r = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir });
  if (r.code !== 0) {
    return err(ErrorCode.GIT_COMMAND_FAILED, "Could not read current branch.", {
      stderr: r.stderr.trim(),
    });
  }
  return ok(r.stdout.trim());
}

/** Fail if `branch` is a default branch we must never write to directly. */
export function assertNotProtected(branch: string): Result<string> {
  if (PROTECTED_BRANCHES.has(branch)) {
    return err(
      ErrorCode.PROTECTED_BRANCH,
      `Refusing to operate on protected branch "${branch}". Create a feature branch first.`,
      { branch },
    );
  }
  return ok(branch);
}

/**
 * Fail if `branch` is one that should only ever receive code through a PR:
 * main, master, or a release branch. Used by commit so that nobody — TL or
 * developer — pushes work straight onto an integration branch.
 */
export function assertCommittable(branch: string): Result<string> {
  if (PROTECTED_BRANCHES.has(branch)) {
    return err(
      ErrorCode.PROTECTED_BRANCH,
      `Refusing to commit on protected branch "${branch}". Work belongs on a feature branch that PRs into release.`,
      { branch },
    );
  }
  if (isReleaseBranch(branch)) {
    return err(
      ErrorCode.PROTECTED_BRANCH,
      `Refusing to commit directly on release branch "${branch}". Branch a feature off it and open a PR into release instead.`,
      { branch, reason: "release-branch" },
    );
  }
  return ok(branch);
}

/**
 * Fail if a PR's base is a branch a human must merge by hand: main or master.
 * Release branches pass — merging feature PRs into release is exactly what the
 * TL is allowed to automate. Merging the release PR into main is the hard stop.
 */
export function assertMergeableInto(base: string): Result<string> {
  if (PROTECTED_BRANCHES.has(base)) {
    return err(
      ErrorCode.PROTECTED_BRANCH,
      `Refusing to merge into "${base}". Landing on a default branch is a human-only action — ` +
        `the release PR must be merged manually. Approve it (review_pr) and hand off to a person.`,
      { base, reason: "human-only-merge" },
    );
  }
  return ok(base);
}
