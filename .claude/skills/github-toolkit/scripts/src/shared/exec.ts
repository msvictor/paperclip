/**
 * Low-level execution primitives shared by the git tools.
 *
 * Two helpers live here:
 *   - `runGit`  : run a local `git` subcommand in a working directory.
 *   - `httpJson`: make a JSON HTTP request (used for the GitHub REST API).
 *
 * Neither helper knows anything about authentication. Callers that need an
 * authenticated request pass in headers built from a connection object. That is
 * the crux of the separation of concerns: secrets flow *through* these helpers,
 * they are never *owned* by them.
 */

import { spawn } from "node:child_process";

export interface GitRunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run a git subcommand. Returns the raw process result; the caller decides what
 * a non-zero exit means. `env` lets a caller inject, e.g., GIT_ASKPASS without
 * mutating the parent process environment.
 */
export function runGit(
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<GitRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({ code: code ?? -1, stdout, stderr }),
    );
  });
}

export interface HttpJsonResult<T = unknown> {
  status: number;
  ok: boolean;
  headers: Headers;
  body: T;
}

/**
 * Thin JSON fetch wrapper. The caller supplies fully-formed headers (including
 * any `Authorization`), so this function stays auth-agnostic.
 */
export async function httpJson<T = unknown>(
  url: string,
  init: RequestInit = {},
): Promise<HttpJsonResult<T>> {
  const res = await fetch(url, init);
  const text = await res.text();
  const body = text ? (JSON.parse(text) as T) : (undefined as T);
  return { status: res.status, ok: res.ok, headers: res.headers, body };
}
