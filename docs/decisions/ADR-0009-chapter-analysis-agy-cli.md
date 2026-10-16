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
4. One signed-in `agy` account per installation, with N parallel processes (N from 1 to 3, also capped by backend `maxConcurrentAnalyses`). Quota observations from `/usage` may pause new claims until reset. The run lives only in the Desktop process, so every end of that process without a result is a definite failure, not an ambiguous one: a Desktop close or crash (`APP_INTERRUPTED`, including `recover` after restart), a timeout that Desktop enforced by killing the process tree (`ANALYSIS_TIMEOUT`) and a process that exited without a usable result (`PROCESS_FAILED`). The job is `FAILED` and the slot is released at once, because no late result can arrive and holding the slot would only stall the queue. `UNKNOWN` (`AMBIGUOUS_OUTCOME`) is reserved for cases where the state of the run is genuinely not known (for example the claim could not be journaled); it is never resent automatically and holds its slot only for a bounded grace period (10 minutes after lease expiry) before it is failed as `OUTCOME_UNRESOLVED`. Re-running is always the person's explicit action, never an automatic resubmission.
5. Story text and CLI output are untrusted. Each run uses an isolated profile (`USERPROFILE`/`HOME`), a temporary working directory that is deleted afterwards, `--sandbox`, `--disable-slash-commands`, a JSON schema and UTF-8 stdin. **Safety gate:** the isolation spike passed on agy 1.3.5 on 2026-10-16 (see the implementation plan). Desktop now opens the gate by default, requires agy 1.3.5 or newer, and retains `NARRATIVEX_AGY_ISOLATION_VERIFIED=0` to close it. `npm run dev:analysis` reruns the live spike against the development profile before launching Desktop. The recorded spike does not prove isolation on every later CLI version; CLI changes require renewed verification.
6. The Desktop attempt journal is encrypted per attempt and does not keep chapter text. Results the backend rejects are kept encrypted locally, with a `SCHEMA_INVALID` observation, and are not re-run. A result that makes the backend answer 5xx five times in a row is treated the same way, so one deterministic server-side failure cannot block every later chapter. Backend materialization turns database constraint violations caused by model output into a 400 rejection, and normalizes enumerated canon labels instead of failing after inference.
7. **Transient failures requeue the chapter.** `RATE_LIMITED`, `QUOTA_EXHAUSTED`, `AUTH_REQUIRED`, `MODEL_UNAVAILABLE` and `PROVIDER_UNAVAILABLE` say nothing about the chapter and produced no output, so the backend returns the job to `QUEUED` and releases the slot (at most 5 attempts per chapter, then the failure is final). Desktop's hold-off keeps it from claiming again straight away. A lease lasts 2 minutes and is renewed by the cancellation poll that already runs every 5 seconds, so a vanished Desktop is noticed within minutes and a long run is never expired under a healthy one. An attempt's fingerprint is bound to the unit numbering (`SourceUnitSegmenter.VERSION`), so a result referring to a different numbering is rejected instead of anchoring to the wrong text.
8. **Long chapters run in windows and a rejected result gets one repair turn (adapter `antigravity-cli/2`).** A chapter above about 6,000 characters is analyzed window by window inside one claim: sequentially, each window naming only its own units (indexes stay global), receiving the identities of the canon found so far and the scene it must continue. Desktop combines the windows; the backend still validates and anchors the whole result. After every window Desktop asks the backend to check the result (`POST /chapter-analyses/{attemptId}/validation`, read-only, partial results are checked against their unit window). When it reports errors Desktop sends one follow-up turn in the same `agy` conversation (`--conversation`) listing them, and keeps the better of the two results; warnings never cost a call. This is one analysis, not a resubmission. Units no cue narrates are narrated verbatim by the backend (`NARRATOR`, `KEEP_EXACT`) so source text is never dropped silently. Window size and the repair turn are IMPLEMENTED and unit-tested with a fake `agy`; they have not been measured against real chapters yet.
9. **Progress is reported by Desktop, not guessed.** A claim sets the job to 0%. While the run lives, Desktop posts `POST /chapter-analyses/{attemptId}/progress` (lease token, 0–99) at real milestones: each window's model turn, its backend check and its end, spread over 0–95%. The backend only ever raises the job's progress, never past 99, ignores the call once the attempt or job is no longer running, and treats a lost write race as harmless; 100% is set only by completion. The call is best effort (an older backend answers 404 and Desktop ignores it). Inside one model turn the CLI gives no signal, so while a turn runs Desktop reports an **estimate** every 3 s: the bar creeps towards the next milestone on an exponential curve sized from the window's character count (20 s plus 20 ms per character), and never reaches that milestone, which only a real result can. A single-window chapter therefore has the real steps 67, 81 and 95%, with estimated steps between them. Streaming `agy` output for real intra-turn progress is not implemented. IMPLEMENTED and unit-tested; runtime UI verification is pending.

## Terminal CLI results

Desktop consumes a complete newline-delimited `event: result` as the authoritative end of an analysis turn, including an error result. It gives `agy` one second to exit, then kills that invocation's process tree if it is still alive, with the existing bounded cleanup fallback. A received result is preserved even when cleanup produces a nonzero exit code; timeout or cancellation before the terminal event still wins. Progress events, model text and incomplete JSON cannot finish a turn. Backend validation and durable result delivery remain required. This avoids waiting for the 30-minute analysis timeout when agy 1.3.6 finishes a turn but leaves its process alive.

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
