# Commit Convention

**Status:** Canonical commit message standard  
**Related:** [Git Workflow](./git-workflow.md) · [Coding Standard §13](./09-coding-standard.md)  
**Format:** [Conventional Commits](https://www.conventionalcommits.org/) 1.0.0

## 1. Subject format

```text
type(optional-scope): imperative summary
```

Rules:

- **type** is required and lowercase.
- **scope** is optional, lowercase, and describes the area touched.
- **summary** is imperative mood (“add”, “fix”, “prevent”), ≤ ~72 characters, no trailing period.
- Separate subject from body with a blank line.
- Wrap body/footer at ~100 characters when practical.

Enforced by **commitlint** on the `commit-msg` Husky hook.

## 2. Allowed types

| Type | When to use |
|---|---|
| `feat` | New feature or user-visible capability |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `docs` | Documentation only |
| `build` | Build system or external dependencies |
| `ci` | CI configuration and scripts |
| `chore` | Maintenance that does not fit other types |
| `revert` | Reverts a previous commit |

## 3. Recommended scopes

Use a single scope when it clarifies the change. Common monorepo scopes:

| Scope | Area |
|---|---|
| `web` | `apps/web` |
| `api` | `apps/api` |
| `worker` | `apps/worker` |
| `ui` | `packages/ui` |
| `contracts` | `packages/contracts` |
| `config` | Shared tooling/config |
| `prisma` | Prisma schema/migrations |
| `docker` | Docker / Compose |
| `ci` | GitHub Actions |
| `auth` | Authentication/session |
| `tenancy` | Organization isolation |
| `inventory` | Properties / Units / Beds |
| `leases` | Leasing |
| `billing` | Billing / invoices |
| `payments` | Payments / webhooks |
| `docs` | Documentation |
| `deps` | Dependency updates |

Scopes are not strictly enumerated by commitlint (free-form), but prefer the table above for consistency.

## 4. Examples

```text
feat(leases): enforce unit occupancy constraints
fix(billing): prevent duplicate recurring charges
docs(architecture): define module dependency rules
chore(deps): bump prisma to 6.19.3
ci: add prisma validate step
refactor(api): extract health module
perf(web): reduce login bundle imports
test(api): cover health endpoint response shape
```

## 5. Body and footer

Use a body when the why is not obvious:

```text
fix(api): reject X-Tenant-ID header

Caller-selected tenant headers enable confused-deputy access.
Organization context must come from the authenticated session token.
```

### Breaking changes

```text
feat(api)!: rename health payload service field

BREAKING CHANGE: `serviceName` is renamed to `service`.
```

Or:

```text
feat(api): rename health payload service field

BREAKING CHANGE: clients must read `service` instead of `serviceName`.
```

### Ticket references

```text
feat(web): add authenticated shell skeleton

Refs: RPM-12
```

## 6. What not to do

- `Fixed stuff` / `Update` / `WIP` without a valid type
- Subject longer than ~72 chars or ending with a period
- Committing secrets and relying on a later “fix”
- Mixing unrelated concerns in one commit when they can be split cleanly
- Using `--no-verify` to bypass commitlint/lint-staged without approval

## 7. Relationship to SemVer / changelog

| Commit signal | Version impact (post-GA guidance) |
|---|---|
| `fix` | PATCH |
| `feat` | MINOR |
| `BREAKING CHANGE` / `type!:` | MAJOR |
| `docs` / `chore` / `ci` / `test` | Usually none |

Pre-GA (`0.y.z`) may include breaking changes within major `0` with explicit notes in [`CHANGELOG.md`](../CHANGELOG.md).

## 8. Local verification

```bash
# Validate the last commit message
pnpm exec commitlint --from HEAD~1 --to HEAD --verbose

# Or message file
echo "feat(web): add login skeleton" | pnpm exec commitlint
```
