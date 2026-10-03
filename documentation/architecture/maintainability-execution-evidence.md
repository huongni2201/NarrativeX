# Maintainability implementation evidence

Plan: [codebase-maintainability-plan.md](codebase-maintainability-plan.md).

Started 2026-10-03 at HEAD `06e381d8ec30d66766dd84c6862e55e194c85044`, with existing reliability changes. Evidence logs and the initial diff are under `.tmp/maintainability/` (local, not a deployment artifact).

## Decisions and dependencies

- Ruling: implement in the current checkout because the plan depends on its uncommitted reliability snapshots and tests; preserve them and do not stage or commit unrelated changes. Risk: the combined working tree needs review before merge.
- Task 3 consumes the admission voice-description policy already present; reference audio is optional for text-conditioned profiles. Read and admission must share that policy.
- Tasks 5/D2 consume the existing `TakeInputSnapshot` and typed Take execution columns; reuse them rather than create a competing intent/snapshot schema.
- Tasks 3/7 consume authoritative timeline/render readiness; selected-count alone cannot prove render readiness.
- Task 4 is also reliability Task 12; implement one canonical cache owner.
- Database D0 must establish applied migration history before D1/D3 schema changes. No database reset, history rewrite, speculative indexes, or legacy-data deletion is authorized by a refactor request.
- Task 9 MapStruct is optional; retain explicit mapping unless a pilot materially simplifies it without new policy or toolchain risk.

## Implemented slices

- Task 1: removed 86 getter bodies across `Take`, `GenerationJob`, `Shot`, and `VisualBeat`; retained only field accessors that already existed.
- Task 2: Lombok `toBuilder` preserves identity, row version, snapshots and checkpoint fields through the validating constructor. `GenerationJobCopyTest` covers copy and validation.
- Task 3: one pure strategy/voice preflight is used for read and admission, voice profiles are memoized per read, and status consults timeline asset/timing evidence. A regression covers missing voices across 100 cues and repeated VisualBeats.
- Task 4 / reliability Task 12: production API and Query keys have one owner; mutations and SSE share project/chapter invalidation. SSE reconnect refreshes snapshots, connection counts balance on unmount, and progress invalidation is throttled. Disconnected queries poll at a bounded rate.
- Task 5 / D2: shot admission's existing immutable snapshot and Take execution links are reused. Persisted legacy intents are typed; malformed snapshot headers and unsupported versions fail before external I/O. Legacy shot selection batches take reads.
- Task 6: local storage IPC moved behind one registration function with the existing channels, trust policy, selection tokens, ProjectStorage lock lifetime and native validation. The facade remains stable.
- Task 7: project dialogs and the empty-state starter cards moved into focused components. Production stage controls read backend readiness; missing status keeps generation and editor readiness closed.
- Task 8: repeated safe pre-submit worker observations share one helper without changing UNKNOWN policy or SQLite journal/outbox transactions. Unreferenced tombstone modules were removed.
- Task 9: chapter production views moved into the application query package; a compiled dependency rule guards common and the migrated view from feature/transport coupling. MapStruct remains optional and was not added.
- C1/C3/C4: SHA-256 and streaming file-integrity primitives, feature-neutral conflict codes, and validated unknown-typed shared API envelopes use existing JDK/Node APIs.
- C2: two existing PostgreSQL integration tests now inherit `PostgreSqlIntegrationTestSupport`. Existing test scenarios and isolation remain intact.

## Verification

- Backend: the final scoped run covered 71 tests, all passed; the latest full backend run also passed 598 tests with zero skips. Maven verification still fails its Spotless check on 16 other dirty Java files (the log details them); all Java files in the maintainability scope passed Spotless.
- Final safety regressions watched the malformed snapshot test fail because the handler called `submitTask`, then pass after fail-closed dispatch; the final handler/Take PostgreSQL run passed 19 tests. Voice-readiness aggregation also failed on an `INNER_MONOLOGUE` cue with a missing profile and now passes with the shared evaluator (10 focused backend tests pass).
- Desktop: `npm run check` passed. It reported 295 tests, 290 passed and 5 intentionally skipped, then type-check and production build passed. The Electron/Vite runtime used an actual Spring backend and disposable PostgreSQL: creating a project worked, Editor and Chapter Workspace loaded, the initial project empty state rendered, and the observed console error list was empty. An Electron screenshot was inspected. Generation and native render/backup/restore flows were not verified.
- Worker: recovery/journal/cancellation/outbox/architecture suites passed (48 tests); Ruff and Mypy passed. The full worker suite had 2 failures in `tests/executors/test_ltx_preflight.py`; that module was added during concurrent work and is outside these edits. Do not count the full worker suite as passing.
- Docs drift and secret scan pass. `git diff --check` is clean for the maintainability edits.
- PostgreSQL Testcontainers applied V1–V10 on disposable databases in integration tests. D0 against the configured local instance failed authentication, including `.env` credentials. No installed-database state is inferred from Testcontainers.

## Remaining gates

- D0 has no authenticated instance inventory. D1/D3 schema/backfill/index/legacy decisions remain TARGET and must not proceed until that inventory and disposal/freeze state are known. Existing typed Take identity was reused; no schema migration or backfill was added.
- Desktop cold reload, lost-SSE recovery, generation/select through a real GPU worker, native media import/preview/render, and backup/restore still need runtime evidence. Browser/unit results do not satisfy those native gates.
- The final `verify-local.ps1` reached the backend gate and stopped on those 16 Spotless violations, before starting its worker steps. A separate full worker run had 2 LTX preflight failures. The provider-independent acceptance gate is not green. Check results and diagnostic logs are retained under `.tmp/maintainability/`.

## Final review

- A fresh reviewer identified the malformed-snapshot fail-open path; its regression was added and passed after the fix.
- The reviewer could not finish a second pass because its run hit the available usage limit. I completed a separate self-review of the scoped changes. That is weaker than an independent final review.
