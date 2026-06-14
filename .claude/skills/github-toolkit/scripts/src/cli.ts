/**
 * cli.ts — the agent-facing front door to the toolkit.
 *
 * The library functions return `Result<T>` objects; this dispatcher turns each
 * one into a command that authenticates once, runs the requested operation, and
 * prints EXACTLY ONE JSON object to stdout. That single-object contract is what
 * makes the tool easy for an agent to drive: run a command, parse one line.
 *
 *   success -> { "ok": true,  "command": "...", "data": { ... } }       exit 0
 *   failure -> { "ok": false, "command": "...", "error": { code, message, details? } }  exit 1
 *
 * Run: GITHUB_TOKEN=ghp_xxx npx tsx src/cli.ts <command> [--flag value ...]
 */

import { connect } from "./connection/index.js";
import * as git from "./git/index.js";
import { isErr, type Result } from "./shared/result.js";
import { ErrorCode } from "./shared/errors.js";

type Flags = Record<string, string | boolean>;

/** Minimal flag parser: --key value, or --key (boolean), or --no-key (false). */
function parseFlags(argv: string[]): Flags {
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (key.startsWith("no-")) {
      flags[key.slice(3)] = false;
    } else if (next === undefined || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i++;
    }
  }
  return flags;
}

function emit(command: string, result: Result<unknown>): never {
  if (isErr(result)) {
    process.stdout.write(JSON.stringify({ ok: false, command, error: result.error }) + "\n");
    process.exit(1);
  }
  process.stdout.write(JSON.stringify({ ok: true, command, data: result.data }) + "\n");
  process.exit(0);
}

function fail(command: string, code: string, message: string): never {
  process.stdout.write(JSON.stringify({ ok: false, command, error: { code, message } }) + "\n");
  process.exit(1);
}

function req(flags: Flags, command: string, name: string): string {
  const v = flags[name];
  if (typeof v !== "string" || v === "") {
    fail(command, ErrorCode.INVALID_ARGUMENT, `Missing required flag --${name}.`);
  }
  return v as string;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) {
    fail("(none)", ErrorCode.INVALID_ARGUMENT, "Usage: cli.ts <command> [--flags]. See SKILL.md.");
  }
  const flags = parseFlags(rest);

  // Authenticate once. Every command needs a connection.
  const conn = await connect();
  if (isErr(conn)) emit(command, conn);
  const c = conn.data;

  switch (command) {
    case "verify-auth":
      emit(command, { ok: true, data: { identity: c.identity, apiBaseUrl: c.apiBaseUrl } });
      break;

    case "read-file":
      emit(command, await git.readFile(c, {
        repo: req(flags, command, "repo"),
        path: req(flags, command, "path"),
        ref: typeof flags.ref === "string" ? flags.ref : undefined,
      }));
      break;

    case "list-tree":
      emit(command, await git.listTree(c, {
        repo: req(flags, command, "repo"),
        ref: typeof flags.ref === "string" ? flags.ref : undefined,
        recursive: flags.recursive === true || flags.recursive === "true",
      }));
      break;

    case "clone":
      emit(command, await git.cloneRepo(c, {
        repo: req(flags, command, "repo"),
        dir: req(flags, command, "dir"),
        depth: typeof flags.depth === "string" ? Number(flags.depth) : undefined,
      }));
      break;

    case "create-branch":
      emit(command, await git.createBranch(c, {
        dir: req(flags, command, "dir"),
        name: req(flags, command, "name"),
        from: typeof flags.from === "string" ? flags.from : undefined,
      }));
      break;

    case "commit":
      emit(command, await git.commitChanges(c, {
        dir: req(flags, command, "dir"),
        repo: req(flags, command, "repo"),
        message: req(flags, command, "message"),
        paths: typeof flags.paths === "string" ? flags.paths.split(",").map((s) => s.trim()) : undefined,
        push: flags.push === false ? false : true,
      }));
      break;

    case "open-pr":
      emit(command, await git.openPr(c, {
        repo: req(flags, command, "repo"),
        head: req(flags, command, "head"),
        title: req(flags, command, "title"),
        base: typeof flags.base === "string" ? flags.base : undefined,
        body: typeof flags.body === "string" ? flags.body : undefined,
        draft: flags.draft === true || flags.draft === "true",
      }));
      break;

    case "get-pr":
      emit(command, await git.getPr(c, {
        repo: req(flags, command, "repo"),
        number: Number(req(flags, command, "number")),
      }));
      break;

    case "list-pr-files":
      emit(command, await git.listPrFiles(c, {
        repo: req(flags, command, "repo"),
        number: Number(req(flags, command, "number")),
      }));
      break;

    case "review-pr": {
      let comments;
      if (typeof flags.comments === "string") {
        try {
          comments = JSON.parse(flags.comments);
        } catch {
          fail(command, ErrorCode.INVALID_ARGUMENT, "--comments must be a JSON array of {path,line,body}.");
        }
      }
      const event = typeof flags.event === "string" ? (flags.event.toUpperCase() as git.ReviewEvent) : undefined;
      emit(command, await git.reviewPr(c, {
        repo: req(flags, command, "repo"),
        number: Number(req(flags, command, "number")),
        event,
        body: typeof flags.body === "string" ? flags.body : undefined,
        comments,
      }));
      break;
    }

    case "create-remote-branch":
      emit(command, await git.createRemoteBranch(c, {
        repo: req(flags, command, "repo"),
        name: req(flags, command, "name"),
        from: typeof flags.from === "string" ? flags.from : undefined,
      }));
      break;

    case "merge-pr":
      emit(command, await git.mergePr(c, {
        repo: req(flags, command, "repo"),
        number: Number(req(flags, command, "number")),
        method: typeof flags.method === "string" ? (flags.method as git.MergeMethod) : undefined,
        commitTitle: typeof flags["commit-title"] === "string" ? flags["commit-title"] : undefined,
        commitMessage: typeof flags["commit-message"] === "string" ? flags["commit-message"] : undefined,
        recordReleaseVersion: flags["record-version"] === false ? false : true,
      }));
      break;

    case "comment-pr":
      emit(command, await git.commentOnPr(c, {
        repo: req(flags, command, "repo"),
        number: Number(req(flags, command, "number")),
        body: req(flags, command, "body"),
      }));
      break;

    default:
      fail(command, ErrorCode.INVALID_ARGUMENT, `Unknown command "${command}". See SKILL.md for the command list.`);
  }
}

main().catch((e) => {
  process.stdout.write(JSON.stringify({
    ok: false,
    command: process.argv[2] ?? "(none)",
    error: { code: "UNCAUGHT", message: (e as Error).message },
  }) + "\n");
  process.exit(1);
});
