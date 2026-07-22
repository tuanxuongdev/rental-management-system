# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| `0.x` (pre-GA foundation) | Yes — security fixes applied on `main` |
| Unreleased local forks | Best-effort |

Replace this table with GA support windows before public release.

## Reporting a vulnerability

**Do not** open a public GitHub issue for security vulnerabilities.

Please report vulnerabilities privately:

1. Email **security@example.com** (replace before public launch), **or**
2. Use GitHub Security Advisories / private vulnerability reporting when enabled on the repository.

Include:

- Description of the issue and impact
- Steps to reproduce or proof of concept
- Affected component (`apps/web`, `apps/api`, `apps/worker`, packages, infra)
- Whether Organization isolation, authentication, or financial integrity is involved
- Your contact details and preferred disclosure timeline

## Response expectations

| Stage | Target |
|---|---|
| Initial acknowledgement | Within 3 business days |
| Severity triage | Within 7 business days |
| Fix / mitigation plan | Based on severity; critical issues prioritized immediately |

We may ask for clarification, additional reproduction details, or coordinated disclosure timing.

## Scope highlights for this product

High-priority concerns include (non-exhaustive):

- Cross-Organization (tenant) data exposure or confused-deputy access
- Authentication/session bypass, token leakage, or unsafe token storage
- Authorization / RBAC bypass
- Injection, SSRF, unsafe file handling, or secret exposure
- Payment/webhook forgery or duplicate financial posts
- Privilege escalation via support elevation or invitation flows

## Out of scope (examples)

- Denial of service from unrealistic traffic without a concrete exploit path
- Reports requiring physical access to an unlocked developer workstation
- Social engineering of non-project third parties
- Findings in dependencies already fixed on `main` with an available upgrade path

## Safe harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations and service disruption
- Do not access or exfiltrate more data than needed to demonstrate the issue
- Report findings promptly through the private channel above
- Do not publicly disclose before an agreed date

## Secrets and credentials

- Never commit `.env`, keys, tokens, or production dumps.
- If a secret is accidentally committed, rotate it immediately and follow incident process — deleting history alone is insufficient.
- Use `.env.example` for non-secret placeholders only.

## Security contacts

| Role | Contact |
|---|---|
| Security mailbox | security@example.com |
| Engineering lead | TBD |

Update contacts before inviting external contributors or publishing the repository.
