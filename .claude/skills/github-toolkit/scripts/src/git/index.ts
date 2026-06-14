/**
 * Public surface of the generalist git tools.
 *
 * Every tool has the same shape: `(connection: GitHubConnection, params) => Result`.
 * They are decoupled from authentication — give any of them a valid connection
 * and they work; swap the auth backend and they don't change.
 */

// --- Change-a-repo workflow (clone -> branch -> commit -> open PR) ---
export { cloneRepo, type CloneParams, type CloneResult } from "./clone.js";
export { createBranch, type CreateBranchParams, type CreateBranchResult } from "./branch.js";
export { commitChanges, type CommitParams, type CommitResult } from "./commit.js";
export { openPr, type OpenPrParams, type OpenPrResult } from "./pull-request.js";

// --- Read-only inspection (no clone needed) ---
export { readFile, listTree } from "./read.js";
export type {
  ReadFileParams, ReadFileResult,
  ListTreeParams, ListTreeResult, TreeEntry,
} from "./read.js";

// --- PR review + comments (pure API, always safe) ---
export { getPr, listPrFiles, reviewPr, commentOnPr } from "./review.js";
export type {
  GetPrParams, GetPrResult,
  ListPrFilesParams, ListPrFilesResult, PrFile,
  ReviewPrParams, ReviewPrResult, ReviewComment, ReviewEvent,
  CommentOnPrParams, CommentOnPrResult,
} from "./review.js";

// --- Release-branching workflow (create release remotely, merge into it) ---
export { createRemoteBranch, type CreateRemoteBranchParams, type CreateRemoteBranchResult } from "./remote-branch.js";
export { mergePr, type MergePrParams, type MergePrResult, type MergeMethod } from "./merge.js";

// --- Shared guards ---
export { currentBranch, assertNotProtected, assertCommittable, assertMergeableInto } from "./guards.js";
