# Git Workflow

**Status:** Canonical contribution workflow  
**Related:** [Commit Convention](./commit-convention.md) · [Coding Standard](./09-coding-standard.md) · [CONTRIBUTING.md](../CONTRIBUTING.md)

## 1. Principles

- Trunk-oriented integration on `main`.
- Short-lived, focused branches.
- Pull requests required; no direct pushes to protected branches.
- Squash merge by default.
- Secrets, `.env` files (except `.env.example`), and credentials never enter Git.

## 2. Default branch

- Default branch: **`main`**
- Protection (configure on GitHub when remote exists):
  - Require pull request reviews
  - Require status checks: `Lint, typecheck, build` (CI job)
  - Require conversation resolution
  - Disallow force pushes and deletions
  - Disallow direct pushes

This document does **not** create a remote repository. Apply branch protection after the remote is created.

## 3. Branch naming

```text
<type>/<ticket>-<short-kebab-description>
```

| Type | Use |
|---|---|
| `feat` | New user-facing or system capability |
| `fix` | Bug fix |
| `chore` | Tooling, deps, non-product maintenance |
| `docs` | Documentation only |
| `refactor` | Internal restructuring without behavior change |
| `test` | Tests only |
| `ci` | CI/CD only |
| `hotfix` | Urgent production fix branched from release/`main` |

Examples (aligned with coding standard):

```text
feat/RPM-123-short-description
fix/RPM-456-short-description
chore/RPM-789-short-description
hotfix/RPM-101-critical-description
```

Rules:

- Prefer a ticket id when one exists (`RPM-###`).
- Keep descriptions short and imperative in spirit (`add-health-endpoint`, not `added-stuff`).
- One concern per branch.

## 4. Daily flow

```text
main
  └─ feat/RPM-123-lease-activate
        ├─ commits (conventional)
        └─ pull request → squash merge → main
```

1. Update `main`: `git fetch origin && git checkout main && git pull --ff-only`
2. Create branch: `git checkout -b feat/RPM-123-lease-activate`
3. Implement and commit using Conventional Commits
4. Push branch: `git push -u origin HEAD` (when remote exists)
5. Open PR using `.github/pull_request_template.md`
6. Address review; keep CI green
7. Squash merge; delete branch

Prefer rebase/update onto latest `main` before merge. Avoid long-lived feature branches.

## 5. Commit hooks

Configured via Husky:

| Hook | Tool | Purpose |
|---|---|---|
| `pre-commit` | lint-staged | ESLint `--fix` + Prettier on staged files |
| `commit-msg` | commitlint | Enforce Conventional Commits |

If hooks do not run after clone:

```bash
pnpm install
pnpm exec husky
```

Do not use `--no-verify` unless explicitly approved for an emergency hotfix, and document why in the PR.

## 6. Pull request requirements

Every PR must include:

- Problem and intended outcome
- Scope / ticket reference
- Security and Organization-isolation impact
- API, DB, config, and operational notes when relevant
- Test evidence
- Migration / rollback notes when schema or deploy behavior changes

Review bar:

- ≥1 qualified reviewer; **2** for security, tenancy, authorization, financial, or high-risk migration changes
- `CODEOWNERS` for shared contracts, auth, tenancy, billing/payments, migrations, and infrastructure

## 7. What not to commit

- `node_modules/`, `dist/`, `.next/`, coverage artifacts
- `.env`, secrets, keys, dumps
- Editor noise (except approved `.vscode/extensions.json`)
- Generated noise unless intentionally versioned (prefer generate in CI)

## 8. Release notes

Update [`CHANGELOG.md`](../CHANGELOG.md) under `[Unreleased]` for user-visible or operationally meaningful changes. Release tagging follows SemVer (`0.y.z` pre-GA).

## 9. Hotfix

1. Branch `hotfix/RPM-###-description` from `main` (or active release tag if defined later).
2. Minimal fix + tests.
3. Expedited review with security/finance awareness as needed.
4. Squash merge; follow with a postmortem if production impact occurred.

## 10. Local-only workflow (no remote yet)

Until a GitHub remote is created:

```bash
git status
git add -A
git commit -m "chore: prepare repository for github"
```

Do **not** run `gh repo create` or `git remote add` unless explicitly requested.
