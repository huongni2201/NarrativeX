# ADR-0034: Local Antigravity CLI for Chapter Analysis

## Status

Superseded by [ADR-0036](ADR-0036-desktop-google-oauth-multi-account-chapter-analysis.md) on 2026-10-15.
Originally accepted 2026-10-14 at the user's explicit choice of a signed-in local CLI. The CLI runner,
login handoff and `ANTIGRAVITY_CLI` selection were removed; the mode remains valid only for history.

## Context

The requested experience is one Google login followed by Chapter Analyze inside Desktop.
ADR-0033 proposes direct OAuth/HTTP access, but the current request selects the official
CLI instead. Google documents headless scripting, while its current FAQ explicitly says
wrapping the CLI in third-party applications is unsupported under consumer plans.
This decision records a requested experimental adapter, not provider approval.

## Decision

- Keep Vertex as the default for existing installations. Account can select
  `ANTIGRAVITY_CLI` for newly admitted jobs; there is no automatic API fallback.
- Electron main discovers the native `agy` executable. The explicit login action opens
  the official interactive CLI on Windows; the CLI owns Google authentication and tokens.
  NarrativeX does not copy cookies, extract keyring entries, or implement Google OAuth.
- Automatically pair the installation through the existing local-device protocol when
  the user connects. This is a machine credential, not a business user/account identity.
- Backend admission freezes the Chapter Analysis 1.1 prompt/schema, model, effort,
  source fingerprint and configuration revision in V13 execution snapshots.
- A device-authenticated claim transaction reserves one global CLI slot and persists
  SUBMITTING before any inference. CLI jobs bypass Vertex dispatch and GPU reconciliation.
  One generic local-session credential metadata row per device has UNKNOWN identity/tier/quota;
  it is not a verified Google account binding.
- Main launches a custom agent with an empty tool allowlist in a fresh scratch directory,
  with no shell or API-key fallback. It waits for the stream initialization and verifies
  the tool inventory before sending story text through stdin. Unsupported tool inventories
  fail closed. CLI source/schema/anchors remain untrusted and backend-validated.
- Main encrypts claim intent, lease and exact output using OS secure storage. A successful
  output is retained before delivery. Reconnect/restart retries delivery only, not inference.
  Lost claim acknowledgments and interrupted executions become UNKNOWN and retain capacity.
  Lease expiry is diagnostic; it never grants permission to replace an ambiguous attempt.
- The backend atomically materializes canon/story/cues, records ANTIGRAVITY_CLI provenance
  and completes the job. Identical completion replay is acknowledged; changed replay fails.
  Rejected results remain encrypted locally and cannot silently trigger a repair generation.
- Cancellation is observed by Desktop and stops its process. Killing a local CLI does not
  establish upstream cancellation, so uncertain outcomes remain UNKNOWN.

## Limits and evidence

Native account login and quota consumption require the user's real CLI session and are
unverified until exercised. CLI discovery/version is distinct from session verification;
the CLI's built-in `/usage` command can verify sign-in separately from model inference.
Its typed command envelope is checked without reading tokens, showing account email or
publishing quota percentages. A valid existing session is reused without opening a terminal;
only an explicit missing-session observation invokes the official interactive OAuth handoff.
Uncertain observations do not sign the user out or fabricate a connected account.
No account rotation or quota percentage
is implemented. Model availability and protocol/tool restrictions can block execution.
UNKNOWN attempts need operator investigation; there is no blind resubmit or automatic slot release.

Vertex model/effort remain deployment configuration. Account's model/effort fields apply to
CLI snapshots only. The existing admission limit still bounds queued expensive work.

## References

- [CLI headless protocol](https://antigravity.google/docs/cli/headless/)
- [Custom agents](https://antigravity.google/docs/subagents/)
- [Provider FAQ](https://antigravity.google/docs/faq/)
- [ADR-0020](ADR-0020-single-user-local-first-architecture.md)
- [ADR-0033 proposal](ADR-0033-direct-antigravity-api-with-desktop-google-oauth.md)
