# ADR-0036: Desktop Google OAuth, Multi-Account Antigravity API Chapter Analysis

## Status

Accepted — 2026-10-15, at the user's explicit request to log in with Google OAuth directly,
skip the CLI, and run analyses in parallel across multiple accounts. It supersedes
[ADR-0034](ADR-0034-local-antigravity-cli-chapter-analysis.md) and implements the Desktop part of
[ADR-0033](ADR-0033-direct-antigravity-api-with-desktop-google-oauth.md). Implementation is PARTIAL
(see Evidence); provider access is **unverified and restricted** by the published Antigravity Terms.

## Context

ADR-0034 delegated login to the `agy` CLI, which gave one session and no account rotation. The user
wants NarrativeX to own the Google login, support several accounts, and run one analysis per account
concurrently. The backend already stores per-credential state (V13: `analysis_provider_credentials`,
per-credential concurrency, identity fingerprint, round-robin ordinal), so the change is mostly
Desktop plus claim semantics.

## Decision

- Add execution mode `ANTIGRAVITY_API`. `ANTIGRAVITY_CLI` stays valid only for historical snapshots/runs;
  new configuration cannot select it and V15 moves an installation still on it back to `VERTEX_API`.
  Queued jobs frozen under the CLI mode are no longer claimable and need operator action.
- Electron main owns OAuth: system browser, PKCE (S256), `state`, a one-shot loopback receiver bound to
  `127.0.0.1` that checks host, path and state, `prompt=select_account consent` so another account can
  be added, and verification that every requested scope was granted.
- The OAuth client is **not committed**. It is supplied through `oauth-client.json` in the app data
  `story-analysis` folder or `NARRATIVEX_ANTIGRAVITY_*` environment variables, validated, and bearer
  tokens are only sent to HTTPS hosts under `googleapis.com`.
- Tokens are encrypted per account with OS secure storage (`safeStorage`), never sent to the renderer,
  backend, logs or PostgreSQL. The backend receives only a masked label and a SHA-256 identity fingerprint;
  the same Google identity logging in again replaces its secrets instead of adding an account.
- One worker per account, one analysis per account at a time. The backend remains the admission
  authority: `claim` takes a `credentialRef` and enforces the enable switch, connection/quota hold-off,
  per-credential limit and the installation-wide `maxConcurrentAnalyses`. Rate limit and quota exhaustion hold
  only the affected account; an expired session (`AUTH_REQUIRED`) stops that account until re-login.
- HTTP 403 is a provider permission refusal (`PROVIDER_REFUSAL`), not evidence of a revoked Google session.
  Keep the local token and distinguish it from a repeated HTTP 401 after refresh, or OAuth `invalid_grant`.
  Account shows permission denial without a re-login prompt and excludes that account from its ready count.
  Local diagnostics expose only the source, HTTP status and fixed `INVALID_GRANT` category; they contain no
  provider response text, tokens or headers and are not sent to the backend. Authentication errors no longer
  assert that Google revoked the session. Successful login/inference clears obsolete diagnostics.
- Recovery semantics from ADR-0021/ADR-0034 are unchanged: claim intent and the exact result are journaled
  (encrypted, per account) before delivery; exactly one generation request is sent; a lost response, 5xx or
  abort is `UNKNOWN`/ambiguous and never resubmitted; a rejected result stays encrypted and is not regenerated.
  A `401` is retried once after a token refresh because the request was not executed.
- Amended 2026-10-15 at the user's explicit request: reuse an account's stored provider `projectId`; when
  absent, generate a local identifier with 9Router's `adjective-noun-<5 hex characters>` format and persist
  it per account. Account preparation no longer calls `loadCodeAssist` or blocks on provider binding.
  Generating an identifier does not create a Google Cloud project or establish provider eligibility.
  Each analysis still sends only its own chapter with a distinct attempt-based `sessionId`.
- Backend additions (V15, `StoryAnalysisRuntimeController`): `POST /api/v1/local-devices/analysis-credentials`
  (+ `/{ref}/observation`, `/{ref}/retire`), `GET|PUT /api/v1/story-analysis/credentials`, `claim` with
  `credentialRef`, and `maxConcurrentAnalyses` in the configuration.

## Limits and evidence

- The request/response envelope (`v1internal:generateContent`, project/model/userAgent/requestId wrapper,
  locally generated project fallback) is based on third-party interoperability evidence, is pinned in one adapter
  (`antigravity-api.ts`, `ADAPTER_VERSION`) and **has not been exercised against the live service**. Structured output is
  requested through `responseMimeType` plus the schema in the instruction and is always revalidated by Spring.
- Effort is not mapped to a provider parameter; the model name carries it (for example `gemini-3.1-pro-high`).
- Provenance stores the adapter revision in the existing `cli_version` column/field; renaming it is deferred.
- Google can restrict or suspend accounts that use third-party clients. The Account screen states this and
  NarrativeX does not verify plan tier or remaining quota.
- Desktop unit tests (OAuth, vault, API mapping, parallel workers, recovery) pass with deterministic fakes. They
  are not provider health. Backend changes were written without a Java 25 toolchain and have **not been compiled
  or run**; PostgreSQL migration/integration tests are pending. Native Account login, a real inference and A/B
  account isolation against the provider are unverified.
- Adapter revision `antigravity-oauth-api/2` removes the provider-binding prerequisite. Acceptance of generated
  identifiers by the live provider remains **unverified**; local readiness does not establish provider health.
  Verification on 2026-10-15: 33 Antigravity/OAuth tests, Desktop typecheck and build passed. The full Desktop
  suite reported 397 passed, 7 skipped and one failure in the unchanged workspace-navigation source test
  (it still expects a workspace Settings item). Documentation drift checks reported the existing missing V15
  inventory. Real Electron Account empty-state/refresh smoke rendered without console errors or horizontal
  overflow; the running backend returned 200 for configuration but 404 for the credential-list endpoint.
  The isolated profile had no OAuth client, so the actual login/generated-project analysis flow remains
  **runtime-verification blocked**. Screenshot and diagnostic report are in
  `.tmp/antigravity-tests/account-empty.png` and `.tmp/antigravity-tests/account-ui-report.json` (local evidence).
- Adapter revision `antigravity-oauth-api/3` fixes the 403 classification. The three new regression tests
  first failed on the original classification and then passed; all 36 Antigravity/OAuth tests, typecheck and
  build passed. An isolated real-renderer browser fixture verified 403, 401 and `invalid_grant`, refresh,
  re-login and empty states in light/dark themes at 390px and 1100px, with 12 screenshots and no console
  errors, failed requests or horizontal overflow (`.tmp/antigravity-auth-errors/report.json`). These fixtures
  do not establish provider health. The full Desktop suite reported 400 passed, 8 skipped and the same
  unchanged workspace-navigation failure. Live-provider login and inference remain **runtime-verification
  blocked** in the isolated verification profile, which has no OAuth client.
  Final Electron empty-state/refresh smoke used real preload and backend transport: configuration and
  credential-list endpoints returned 200, with no console errors or failed requests. This supersedes the
  earlier 404 smoke observation for that running backend; it does not verify provider access. Documentation
  drift checks still report the unrelated missing V15 inventory.

## References

- [ADR-0020](ADR-0020-single-user-local-first-architecture.md), [ADR-0021](ADR-0021-submission-checkpoint-and-worker-recovery-semantics.md)
- [ADR-0033](ADR-0033-direct-antigravity-api-with-desktop-google-oauth.md), [ADR-0034](ADR-0034-local-antigravity-cli-chapter-analysis.md)
- [Google OAuth for installed apps](https://developers.google.com/identity/protocols/oauth2/native-app)
