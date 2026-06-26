# Principle 4 — Testing Safety Net

## Why Agents Need Tests

AI agents are prone to introducing unexpected side effects. Without a fast, unambiguous feedback loop, agents cannot self-correct — they submit broken code or loop endlessly without making progress.

## Requirements

### Speed
- Unit tests must complete in **under 30 seconds** locally.
- If the suite takes longer, split it: fast unit tests (`test:unit`) run on every change; slow integration tests (`test:integration`) run before PR.
- Agents must be able to run the fast suite after every meaningful change.

### Unambiguous Output
- Test output must be machine-parseable: explicit pass/fail per test, with stack traces for failures.
- No interactive prompts, no color-only differentiation, no progress bars that obscure errors.
- Exit code must be non-zero on any failure (`0` = all pass, `1` = failure). Agents rely on exit codes to detect failure.

```bash
# Good — explicit, parseable
PASS src/auth/auth.service.spec.ts
FAIL src/users/users.service.spec.ts
  ● UsersService › findOne › should throw when user not found
    Expected: Error("User not found")
    Received: undefined

# Bad — ambiguous, no actionable detail
✓ 47 tests passed
✗ 1 test failed (see report)
```

### Single CI Command
- There must be one command that runs the full verification suite: typecheck + lint + tests.
- Agents use this before every PR. It must work from a clean checkout.

```bash
# Example single CI command
bun run ci
# which runs: typecheck && lint && test:unit && test:integration
```

Document this command explicitly in AGENTS.md.

## Test Structure

Co-locate unit tests with source files:
```
src/
  users/
    users.service.ts
    users.service.spec.ts    ← unit test next to the file it tests
  auth/
    auth.service.ts
    auth.service.spec.ts
```

Integration and E2E tests in a top-level directory:
```
test/
  e2e/
    auth.e2e-spec.ts
  integration/
    users.integration-spec.ts
```

## Minimum Coverage Gates

| Layer | Minimum |
|---|---|
| Service / business logic | 80% line coverage |
| API controllers / routes | All happy paths + 401/403/404 |
| Utility functions | 100% |
| UI components | Key interaction paths (not snapshots) |

## Audit Check

When auditing a repository:
- Does a test command exist in `package.json`? (missing → add at minimum a placeholder)
- Does it complete in <30 seconds? (too slow → profile and split)
- Is output machine-parseable? (not parseable → configure reporter)
- Is there a single CI command documented in AGENTS.md? (missing → add it)
- Are tests co-located with source? (centralized → migrate to co-location pattern)
