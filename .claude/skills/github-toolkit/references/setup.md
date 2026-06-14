# Setup: creating a GitHub token

The toolkit reads a single credential from the `GITHUB_TOKEN` environment variable. It never
stores it on disk and never prints it. You only need to do this once per shell session.

## Which token type?

Either works — the connection layer handles both:

- **Fine-grained personal access token** (recommended). Scoped to specific repositories and
  permissions. Create at **GitHub → Settings → Developer settings → Fine-grained tokens**.
  Grant it **Contents: Read and write** and **Pull requests: Read and write** on the repos you'll
  touch. (Fine-grained tokens enforce permissions server-side, so `verify-auth` may report an
  empty `scopes` list — that's normal.)

- **Classic personal access token**. Simpler but broader. Create at **GitHub → Settings →
  Developer settings → Tokens (classic)** and grant the **`repo`** scope. With a classic token,
  `verify-auth` will list the granted scopes.

## What permissions are needed for each workflow

| workflow | needs |
|----------|-------|
| Read files / list tree | read access to repo contents |
| Change a repo via PR | **write** access to contents (commit/push) **and** pull requests (open PR) |
| Review a PR | read access to the repo + pull requests; write to leave comments/reviews |

If a command returns `INSUFFICIENT_SCOPE` or a 403/404 `API_REQUEST_FAILED`, the token is missing
a permission — recreate it with the rows above.

## Setting it

```bash
export GITHUB_TOKEN=ghp_your_token_here
cd scripts && npx tsx src/cli.ts verify-auth
```

A successful `verify-auth` prints your login and id. Keep the token out of source control and out
of command history where you can (e.g. `export GITHUB_TOKEN=$(cat ~/.gh_token)`).

## GitHub Enterprise Server

The default API base is `https://api.github.com`. For Enterprise, the connection layer accepts an
`apiBaseUrl` override — set it where `connect()` is called in `scripts/src/cli.ts`, or extend the
CLI to read a `GITHUB_API_URL` env var.
