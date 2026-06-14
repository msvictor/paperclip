/**
 * End-to-end example: the "change a repo via PR" workflow, showing how the two
 * layers compose. Auth happens exactly once; every git tool is then handed the
 * same connection object.
 *
 * Run: GITHUB_TOKEN=ghp_xxx npx tsx src/example.ts
 */

import { connect } from "./connection/index.js";
import { cloneRepo, createBranch, commitChanges, openPr } from "./git/index.js";
import { isErr } from "./shared/result.js";
import { writeFile } from "node:fs/promises";

async function main() {
  // 1. Authenticate — the ONLY step that touches credentials.
  const conn = await connect({ requiredScopes: ["repo"] });
  if (isErr(conn)) throw new Error(conn.error.message);
  const connection = conn.data;
  console.log(`Connected as ${connection.identity.login}`);

  const repo = "octocat/hello-world";
  const dir = "./work";

  // 2. Clone — git tool, receives the connection.
  const cloned = await cloneRepo(connection, { repo, dir });
  if (isErr(cloned)) throw new Error(cloned.error.message);

  // 3. Branch.
  const branch = await createBranch(connection, { dir, name: "chore/example" });
  if (isErr(branch)) throw new Error(branch.error.message);

  // 4. Edit files on disk with your normal tooling.
  await writeFile(`${dir}/NOTES.md`, "Added by github-toolkit.\n");

  // 5. Commit + push (guarded against protected branches).
  const committed = await commitChanges(connection, {
    dir,
    repo,
    message: "chore: add notes",
  });
  if (isErr(committed)) throw new Error(committed.error.message);

  // 6. Open the PR.
  const pr = await openPr(connection, {
    repo,
    head: committed.data.branch,
    title: "Add notes",
    body: "Demonstrates the decoupled toolkit.",
  });
  if (isErr(pr)) throw new Error(pr.error.message);

  console.log(`Opened PR #${pr.data.number}: ${pr.data.url}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
