# ADR-0033: Direct Antigravity API with Desktop Google OAuth for Chapter Analysis

## Status

Proposed — revised 2026-10-14 to follow the user's confirmed direct Antigravity HTTP API
and Google OAuth flow. Foundations exist, but OAuth, inference, account isolation and native
runtime evidence are not implemented or verified. Provider support remains restricted by the
published Antigravity Terms; this proposal does not claim an approved integration.

Update 2026-10-15: the Desktop OAuth/API path and multi-account execution were accepted and
partially implemented in [ADR-0036](ADR-0036-desktop-google-oauth-multi-account-chapter-analysis.md),
which also fixes the OAuth client supply (user-provided, not committed). Items not covered there stay proposed.

## Context

ADR-0022 places Chapter Analysis in a synchronous Vertex Gemini integration owned by Spring.
The requested alternative starts Google login from NarrativeX Account, stores provider tokens
locally, and calls Antigravity's HTTP API directly. It removes the installed Antigravity IDE/CLI
dependency and replaces process/keyring integration with OAuth and an HTTP adapter in Electron main.

9Router provides reference implementations for OAuth, provider binding and direct inference.
These are interoperability evidence, not a public API stability or provider permission guarantee.
Using HTTP does not remove the service's third-party access restriction.

Business admission, durable attempts, assignments and result materialization must remain in
Spring/PostgreSQL. ADR-0020 permits provider credentials as runtime concerns without restoring
NarrativeX application accounts or login.

## Proposed decision

1. Add an opt-in `ANTIGRAVITY_API` execution path in Electron main. Main owns Google OAuth,
   a protected per-credential token store, refresh, provider binding/model discovery and a bounded
   HTTPS adapter. Account starts and tracks login; Google authorization uses the system browser
   and a correlated loopback callback. The renderer receives only redacted metadata/events.
2. Pin a compatible OAuth client profile, required scopes, API/adapter revision and sanitized
   request/response fixtures. A generic Google Sign-In token is not proof of Antigravity access.
   Tokens, codes, verifiers and provider identity secrets remain local; PostgreSQL holds opaque refs.
3. Keep Spring/PostgreSQL authoritative for desired config, registry metadata, admission,
   credential selection, queue/slots, leases/fences, retry decisions and atomic materialization.
   Machine execution credentials remain separate from Google OAuth.
4. Freeze mode/model/effort, selection policy, source/config/prompt/schema revisions and hashes
   on enqueue. Existing Vertex and legacy CLI snapshots retain their meanings. A legacy CLI
   snapshot without a runner reports unavailable; it is not silently executed through HTTP.
5. Persist backend submission intent and local request intent before inference. Send one generation
   request for the assigned attempt. Disable automatic generation POST retries and preserve
   `UNKNOWN` after any ambiguous submission, stream loss, abort, crash or lease expiry.
   Request correlation IDs do not imply upstream idempotency or execution lookup.
6. Journal terminal result/checksum before delivery. Retry the same stored completion after
   transport/DB errors; validate identity, fingerprint, source/canon/schema and completion hash
   before one atomic materialization. Never issue inference again to recover a stored result.
7. Deduplicate verified provider identity and test independent A/B token/refresh/reconnect/revoke
   behavior before enabling a pool. Backend enforces pinned/round-robin selection and limits;
   token refresh alone does not change attempt identity or credential generation.
8. Require bounded JSON/SSE parsing, no execution of model tool calls, truthful usage/quota
   observations and native Account/Chapter flow evidence. Missing provider lookup keeps ambiguous
   attempts unresolved; local socket cancellation does not prove cloud cancellation.
9. Keep the GPU compute protocol and `app/generation-service` boundary intact. No provider login,
   text-generation task, business database access, public proxy or new business service is added.

## Consequences

- Login/account management stays in NarrativeX without an installed Antigravity process or session.
- Electron gains OAuth callback, token protection/refresh and HTTP interoperability responsibilities;
  the earlier CLI binary/version/tool-sandbox requirements no longer define the target path.
- Provider API/client eligibility and Terms are material limitations. They are recorded separately
  from authentication success and analysis readiness; no fake supported/connected status is allowed.
- Existing shared schema/V13 foundations can be reused, but API mode/checkpoint/provenance changes
  need contract and migration work. Historical snapshots are not rewritten.
- Single-account and pool acceptance remain separate. Live provider/native evidence is required;
  ordinary deterministic test adapters do not establish production health.

## Supersession scope

If accepted, this proposal supersedes ADR-0022 only for new jobs explicitly assigned to the optional
Desktop OAuth/API route. ADR-0022 remains authoritative for existing Vertex jobs. It does not restore
application identity, monetary billing, automatic provider fallback or GPU-plane chapter analysis.

## References

- [Direct API research](../product/ANTIGRAVITY_OAUTH_API_RESEARCH.md)
- [Story analysis plan v3](../product/ANTIGRAVITY_STORY_ANALYSIS_IMPLEMENTATION_PLAN.md)
- [Account plan](../product/ACCOUNT_TAB_IMPLEMENTATION_PLAN.md)
- [ADR-0020](ADR-0020-single-user-local-first-architecture.md)
- [ADR-0021](ADR-0021-submission-checkpoint-and-worker-recovery-semantics.md)
- [ADR-0022](ADR-0022-vertex-gemini-chapter-analysis.md)
- [ADR-0025](ADR-0025-event-driven-compute-orchestration-and-reconciliation.md)
- [Compute Protocol](../COMPUTE_PROTOCOL.md)
