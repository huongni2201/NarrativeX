# Render Lifecycle Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the six reviewed NarrativeX render/idempotency defects while making render delivery route-independent and retryable.

**Architecture:** Main owns pending render-delivery tasks keyed by projectId/jobId after destination binding, so renderer route lifetime and one-shot selection tokens do not control completion. Local execution uses a session epoch and transient heartbeat retry scheduler. Backend media job replay validates job type, scope, and request fingerprint at job level.

**Tech Stack:** Electron/TypeScript/React, Node test runner, Java 25/Spring/MyBatis/JUnit.

**Spec:** `docs/superpowers/specs/2026-09-05-render-lifecycle-reliability-design.md`

## Global Constraints

- Do not change SSE architecture or asset hashing in this change.
- Do not depend on synchronous React state updates between destination selection and render start.
- Do not re-render solely because delivery failed.
- Authentication/session invalidation must stop pending claims from starting work.

---

### Task 1: Lock the reviewed regressions with failing tests

**Files:**
- Modify: `app/desktop/test/render-delivery-retry.test.mjs`
- Create: `app/desktop/test/render-lifecycle-regressions.test.mjs`
- Modify/Create focused backend test under `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/`

**Interfaces:**
- Consumes current `SelectionTokenStore`, render IPC, `LocalExecutionService`, `CreateMediaJobUseCase`.
- Produces failing behavior tests for retry, route-independent delivery state, pending-claim invalidation, heartbeat retry, and idempotency conflicts.

- [ ] Write desktop tests that demonstrate delivery authorization remains usable after a failed delivery attempt and that a render command can consume the destination object returned by selection directly.
- [ ] Write service tests for logout/account change during a delayed claim and transient initial heartbeat recovery.
- [ ] Write backend tests for same idempotency key with wrong job type/scope/request.
- [ ] Push test-only commit and verify CI fails for the intended missing behaviors.

### Task 2: Make destination selection and RenderScreen start atomic at the controller API boundary

**Files:**
- Modify: `app/desktop/src/renderer/features/production/useRenderController.ts`
- Modify: `app/desktop/src/renderer/features/production/screens/RenderScreen.tsx`
- Modify: `app/desktop/src/renderer/features/production/components/RenderDialog.tsx` only if needed to share the same command.

**Interfaces:**
- Produces `chooseDestinationAndStartRender()` (or equivalent) that uses the destination object returned from the native dialog directly.
- `startRender` accepts an optional explicit destination rather than requiring newly-set React state.

- [ ] Implement the smallest controller API that selects destination and starts using that returned selection without waiting for React state.
- [ ] Wire RenderScreen's `Choose folder & render` button to that command.
- [ ] Keep RenderDialog's explicit choose/change workflow compatible.

### Task 3: Move delivery authorization and retry lifecycle into Electron main

**Files:**
- Create: `app/desktop/src/main/rendering/render-delivery-task-store.ts`
- Modify: `app/desktop/src/main/local-storage/project-catalog-ipc.ts`
- Modify: `app/desktop/src/main/rendering/render-destination.ts`
- Modify: `app/desktop/src/main/bootstrap-core.ts` if registration/recovery status needs the store.
- Modify preload types/index only if IPC contracts change.

**Interfaces:**
- Destination selection token authorizes binding a directory to a delivery task; it is not consumed as the sole retry capability.
- Store exposes bind/get/markDelivering/markFailed/markDelivered with a per-task concurrent-delivery guard.
- Delivery copies to a temporary destination path and renames to final destination.

- [ ] Add behavior tests for bind once, retry after copy failure, concurrent-delivery rejection, and successful terminal delivery.
- [ ] Implement task store and bind token lifecycle.
- [ ] Update deliver IPC so legitimate retries do not fail with `Local selection expired` after the first copy attempt.
- [ ] Ensure render duration exceeding the original one-hour token TTL cannot invalidate an already-bound task.

### Task 4: Recover delivery independently of renderer route lifetime

**Files:**
- Modify: `app/desktop/src/main/rendering/render-journal.ts` or add a focused delivery journal/store persisted under project work state.
- Modify: `app/desktop/src/main/bootstrap-core.ts`
- Modify: `app/desktop/src/renderer/features/production/useRenderController.ts`

**Interfaces:**
- Main can query/recover pending delivery by projectId/jobId after route unmount/restart.
- Renderer subscribes/queries delivery state; it is no longer the sole trigger for final copy.

- [ ] Add persistence/recovery test for a pending or failed delivery task.
- [ ] Persist destination task state in local project work state without storing ephemeral renderer sender tokens.
- [ ] Trigger/continue delivery from main when artifact is available, and expose retry/status to renderer.

### Task 5: Close pending-claim session race and add heartbeat retry

**Files:**
- Modify: `app/desktop/src/main/local-execution/service.ts`
- Modify focused tests under `app/desktop/test/`.

**Interfaces:**
- `sessionEpoch` increments on logout, user change, unpair, and stop.
- A claim captures epoch and revalidates identity/user/state after await before installing `activeRender`.
- Heartbeat retry uses one timer, bounded exponential delay, jitter, and no overlapping heartbeat requests.

- [ ] Implement session epoch and post-claim revalidation.
- [ ] If a claim becomes invalid before work starts, cancel/fail/release it through existing lease semantics and return without prepare/render.
- [ ] Implement transient heartbeat retry scheduling; auth rejection clears identity and cancels retry.
- [ ] Start render polling only after ONLINE state is re-established.

### Task 6: Harden media job idempotency replay

**Files:**
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateMediaJobUseCase.java`
- Modify domain/persistence only as needed to store a job-level request fingerprint.
- Modify focused JUnit tests.

**Interfaces:**
- Existing replay must be `JobType.CHAPTER_GENERATE` and match projectId, chapterId, and request fingerprint.
- Mismatch throws `GenerationAdmissionDeniedException("IDEMPOTENCY_CONFLICT", ...)`.

- [ ] Reuse the `CreateProjectRenderUseCase` validation pattern.
- [ ] Persist/compare request-level fingerprint at job level; do not infer replay validity from media child items.
- [ ] Keep valid same-request replay returning the original job and avoid duplicate enqueue/quota reservation.

### Task 7: Verification and cleanup

**Files:** all touched files.

- [ ] Run Desktop `npm test`, `npm run type-check`, `npm run build`, and `npm run check` via CI/workspace.
- [ ] Run backend focused tests then full `./mvnw --batch-mode --no-transfer-progress verify` via CI/workspace.
- [ ] Confirm no unrelated SSE/asset optimization entered the diff.
- [ ] Replace obsolete regex-only assertions where equivalent behavioral coverage now exists.
- [ ] Review the final diff for token/session leakage and retry loops.
