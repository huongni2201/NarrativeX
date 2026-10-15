# ADR-0009: Chapter Analysis runs through the user's `agy` CLI session on Desktop

- **Status:** Accepted — implementation PARTIAL (see [current status](../current-status.md))
- **Date:** 2026-10-15
- **Replaces:** former ADR-0038 and the earlier Vertex Gemini, direct Antigravity API with Desktop OAuth, local Antigravity CLI and OAuth multi-account decisions (Git history)

## Context

Chapter Analysis is a long text-to-JSON LLM call per chapter. The user wants to spend the quota of existing Google AI Pro subscriptions instead of paying for API usage. Earlier attempts (a Vertex API, a NarrativeX-owned OAuth flow with direct HTTP inference, and multi-account token rotation) either cost money, failed with `SERVICE_DISABLED`, or made NarrativeX hold Google tokens.

## Decision

1. Electron main runs the installed `agy` CLI (minimum version checked at discovery) as the Chapter Analysis runner. `agy` owns Google login and stores its session in Windows Credential Manager. NarrativeX never reads, copies or rotates that credential.
2. Spring/PostgreSQL stay authoritative for admission, frozen prompt snapshots, jobs, leases, attempts, result validation and materialization (ADR-0003, ADR-0006). Desktop claims work, runs the CLI and reports completion or an observation. generation-service is not involved in text analysis.
3. The schema, Java enum and Desktop-owned API types use only `execution_mode = ANTIGRAVITY_CLI`. Run provenance records `adapter_version = antigravity-cli/1`. Each Desktop device has at most one opaque credential slot, which holds no token, email or profile path.
4. One signed-in `agy` account per installation, with N parallel processes (N from 1 to 3, also capped by backend `maxConcurrentAnalyses`). Quota observations from `/usage` may pause new claims until reset. Ambiguous outcomes (timeout, killed process, unrecognized failure after start) become `UNKNOWN` and are never resent automatically.
5. Story text and CLI output are untrusted. Each run uses an isolated profile (`USERPROFILE`/`HOME`), a temporary working directory that is deleted afterwards, `--sandbox`, `--disable-slash-commands`, a JSON schema and UTF-8 stdin. **Safety gate:** no real story text is sent unless Electron starts with `NARRATIVEX_AGY_ISOLATION_VERIFIED=1`. That flag may be set only after an isolation test proves the process cannot read outside its working area, use tools or write files.
6. The Desktop attempt journal is encrypted per attempt and does not keep chapter text. Results the backend rejects are kept encrypted locally, with a `SCHEMA_INVALID` observation, and are not re-run.

## Deferred

- **Rotating several Google AI Pro accounts** (for example the user's 3 accounts) to add quota is a planned direction. It is not implemented. When designed, it must keep invariant 1 (NarrativeX holds no Google tokens), so it must switch through `agy`'s own session handling or explicit user action rather than token storage. The backend's single-slot-per-device constraint must change in the same decision.
- A result cache keyed on chapter, prompt, schema and model, plus a fallback CLI provider, are possible optimizations and are not decided here.

## Invariants

1. NarrativeX stores no Google token, OAuth state, email or profile path.
2. No OAuth callback, app-owned provider token, direct HTTP inference or API fallback exists for analysis.
3. The isolation gate is enforced in code and cannot be bypassed by UI.

## Consequences

- No per-call API cost. Quota is observed but not guaranteed.
- Wrapping a consumer CLI inside a third-party app is subject to Google's terms and is not represented as provider-approved.
- CLI flags and the response envelope can change between `agy` versions, so version checks and envelope regression tests are required.
- Each call has a fixed overhead of roughly 13k input tokens and 11–21 s.

## Related

- [Implementation plan](../plans/agy-cli-chapter-analysis.md) · [ADR-0001](ADR-0001-single-user-local-first.md) · [ADR-0003](ADR-0003-durable-compute-execution.md) · [ADR-0006](ADR-0006-story-structure-and-source-anchoring.md)
