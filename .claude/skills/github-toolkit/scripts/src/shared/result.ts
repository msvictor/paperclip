/**
 * A tiny Result type used across every module.
 *
 * Every public function returns a `Result<T>` instead of throwing, so callers
 * branch on `result.ok` exactly the way the original CLI emitted `{ "ok": ... }`
 * JSON. This keeps error handling uniform and serialisable.
 */

export interface GitHubErrorShape {
  /** Stable machine-readable code (see ./errors.ts). */
  code: string;
  /** Human-readable, safe-to-surface message. */
  message: string;
  /** Optional structured context. Never put secrets here. */
  details?: Record<string, unknown>;
}

export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; error: GitHubErrorShape };
export type Result<T> = Ok<T> | Err;

export const ok = <T>(data: T): Ok<T> => ({ ok: true, data });

export const err = (
  code: string,
  message: string,
  details?: Record<string, unknown>,
): Err => ({ ok: false, error: { code, message, details } });

/** Narrowing helpers, handy at call sites. */
export const isOk = <T>(r: Result<T>): r is Ok<T> => r.ok;
export const isErr = <T>(r: Result<T>): r is Err => !r.ok;
