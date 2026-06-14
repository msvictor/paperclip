# Release Branching workflow

A controlled path for getting work onto `main`: developers integrate into a shared, **versioned**
`release/vX.Y.Z` branch through reviewed PRs, and only a human merges that release branch into
`main`. The toolkit enforces the hard parts in code so they can't be skipped:

- **Release branches are versioned.** `create-remote-branch` requires a `vX.Y.Z` name
  (`release/v1.4.0`, `release-v2.0.0`, `release/v1.4.0-rc.1`). The version is what records which
  release a feature shipped in; an unversioned `release` is rejected with `INVALID_ARGUMENT`.
- **No direct commits to `main`, `master`, or any release branch.** Code reaches an integration
  branch only through a PR. (`commit` returns `PROTECTED_BRANCH`.)
- **No automated merge into `main`/`master`.** `merge-pr` integrates feature PRs into the release
  branch, but refuses any PR whose base is a default branch — that final merge is a person's job.
  (`merge-pr` returns `PROTECTED_BRANCH`.)
- **The release version is documented automatically.** Merging a feature PR into `release/v1.4.0`
  leaves a "✅ Merged into release `v1.4.0`" note on that PR, so you can always see which release
  it went out in.

## The six steps

Roles below describe who's responsible; the commands are the same whoever runs them. The examples
use `release/v1.4.0` — substitute the version you're actually cutting.

### 1 — TL cuts the versioned release branch from main

No clone needed; create the ref over the API. The name must carry the target version.

```bash
npx tsx src/cli.ts create-remote-branch --repo owner/name --name release/v1.4.0 --from main
```

`--from` defaults to the repo's default branch, so `--from main` is usually optional. The result
includes `version: "v1.4.0"`. An unversioned name like `--name release` is rejected — pick the
version the cut will become.

### 2 — Developer branches a feature off the release branch

Work happens in a clone. Branch **from the release branch**, not from `main`, so the PR diff is
clean.

```bash
npx tsx src/cli.ts clone --repo owner/name --dir ./work
# Base the feature on the release branch (origin/release/v1.4.0 after a fresh clone):
npx tsx src/cli.ts create-branch --dir ./work --name feat/checkout-coupons --from origin/release/v1.4.0
# ...edit files in ./work with your normal tools...
```

If `origin/release/v1.4.0` isn't present in the clone yet, fetch it first
(`git -C ./work fetch origin release/v1.4.0`) or clone after step 1.

### 3 — Developer opens a PR into the release branch

The base must be the versioned release branch — otherwise the PR points at `main` and the diff
balloons.

```bash
npx tsx src/cli.ts commit --dir ./work --repo owner/name --message "feat: coupon codes at checkout"
npx tsx src/cli.ts open-pr --repo owner/name --head feat/checkout-coupons --base release/v1.4.0 \
  --title "Coupon codes at checkout" --body "Adds coupon entry + validation."
```

### 4 — TL reviews, approves, and merges the feature PR into the release branch

Read the diff, leave a verdict, then integrate. This merge is allowed because the base is a release
branch — and it stamps the PR with the release version.

```bash
npx tsx src/cli.ts list-pr-files --repo owner/name --number 57
npx tsx src/cli.ts review-pr --repo owner/name --number 57 --event APPROVE --body "LGTM."
npx tsx src/cli.ts merge-pr --repo owner/name --number 57
#   -> merges, and comments "✅ Merged into release v1.4.0" on PR #57.
#   -> returns { merged, sha, base, releaseVersion: "v1.4.0", versionRecorded: true }
#   Pass --no-record-version to merge without leaving the note.
```

Note GitHub won't let you approve a PR you opened yourself. If branch protection requires an
approval before merge and you authored the PR, a different reviewer must approve it.

### 5 — TL opens the release PR into main

Once the release branch holds everything for this cut, open the PR that proposes landing it. Title
it with the version so the release is self-documenting.

```bash
npx tsx src/cli.ts open-pr --repo owner/name --head release/v1.4.0 --base main \
  --title "Release v1.4.0" --body "Rolls up: coupons, ..."
```

Opening this PR is fine — it's only a proposal. Merging it is the part that's gated.

### 6 — The hard stop: a human merges the release into main

The TL (or anyone) can review and approve the release PR, but the merge itself is human-only.

```bash
npx tsx src/cli.ts review-pr --repo owner/name --number 60 --event APPROVE --body "Ship it."
# Do NOT run merge-pr on this one. If you try:
npx tsx src/cli.ts merge-pr --repo owner/name --number 60
#   -> { "ok": false, "error": { "code": "PROTECTED_BRANCH", ... } }
```

When you reach this point, approve the PR and tell the user plainly: the merge into `main` is
theirs to perform. That `PROTECTED_BRANCH` response is the guard working as designed — it isn't a
failure to route around, and there is deliberately no flag to override it.

## Quick reference

| step | actor | command | base |
|------|-------|---------|------|
| 1 | TL | `create-remote-branch --name release/v1.4.0 --from main` | — |
| 2 | Dev | `clone` + `create-branch --from origin/release/v1.4.0` | — |
| 3 | Dev | `commit` + `open-pr --base release/v1.4.0` | release/v1.4.0 |
| 4 | TL | `review-pr --event APPROVE` + `merge-pr` (records version) | release/v1.4.0 ✅ merges |
| 5 | TL | `open-pr --head release/v1.4.0 --base main` | main |
| 6 | Human | review/approve, then **merge by hand** | main 🛑 merge blocked |

## Naming

A release branch must match `release/vX.Y.Z` or `release-vX.Y.Z`, with an optional pre-release or
build suffix:

- ✅ `release/v1.4.0`, `release-v2.0.0`, `release/v1.4.0-rc.1`, `release/v3.0.0+build.5`
- ❌ `release` (no version), `release/1.4.0` (missing `v`), `release/v1.4` (not three-part)
