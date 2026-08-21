# ADR-0013: Out-of-band E2E credentials and repository secret scanning

- Status: Accepted
- Date: 2026-08-21
- Scope: Local browser/API test authentication, CI test authentication, repository guidance, and secret scanning.

## Context

Reusable E2E login credentials in repository guidance are secrets once the account can authenticate against a real deployment. Private repositories and Git history do not remove the exposure risk, and deleting the current line does not remove old clones or commits.

## Decision

- Test authentication reads `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` from the process environment.
- Developers may keep values in the ignored `.env.e2e.local`; CI must use GitHub Actions Secrets or an equivalent secret store.
- Repository guidance, source code, logs, screenshots, and test artifacts must not contain the values.
- CI runs `scripts/check-secrets.py` on every push and pull request to detect inline credential guidance, private-key material, and common access-token patterns.
- If a credential was previously committed, operators must rotate the account password and revoke active sessions before relying on the account again. History rewriting is a separate cleanup operation and does not replace rotation.

## Consequences

Local and CI setup has one explicit environment contract, while the repository no longer acts as a credential distribution channel. Rotation and Git-history cleanup remain operational actions requiring access to the identity provider and repository hosting controls.
