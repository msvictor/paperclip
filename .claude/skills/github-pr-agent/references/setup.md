# Token setup

The tool authenticates with a GitHub token read from the `GITHUB_TOKEN` environment variable.
It never accepts the token as a command-line flag, so the secret stays out of shell history and
process listings.

## Create a token

You can use either token type.

### Fine-grained personal access token (recommended)
1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
2. Set **Resource owner** and limit **Repository access** to only the repos this agent should touch.
3. Under **Repository permissions**, grant:
   - **Contents**: Read and write (clone, push branches).
   - **Pull requests**: Read and write (open PRs, post reviews/comments).
   - **Metadata**: Read (granted automatically).
4. Generate and copy the token.

### Classic personal access token
Scope: `repo` (full control of private repositories). Broader than needed — prefer fine-grained.

## Make it available to the tool

Temporary, current shell only:
```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxx
```

Or via a local `.env` (copy `.env.example` to `.env`), then load it before running:
```bash
set -a; source .env; set +a
```
Do **not** commit `.env`. Add it to `.gitignore`.

Verify:
```bash
npx tsx scripts/git-pr-tool.ts verify-auth
```
Expect `{"ok": true, ..., "data": {"login": "<you>", ...}}`.

## Optional: extra protected branches

Beyond the built-in `main`/`master` and the repo's real default branch, you can mark more
branches as off-limits for writes:
```bash
export PROTECTED_BRANCHES=develop,release,production
```

## Security notes
- A token grants write access to your repos. Scope it to the minimum repos and permissions.
- Clones contain the token in `.git/config`. Treat clone directories as secret and ephemeral;
  delete them when done.
- Rotate or revoke the token if it may have been exposed.
