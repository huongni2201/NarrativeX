# Parallel Chapter Processing and Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow multiple chapter audio/analysis jobs to run independently, expose batch audio generation, and make chapter numbering/order explicit in the desktop UI.

**Architecture:** Keep PostgreSQL generation jobs and chapter workspaces as the source of truth. The desktop submits single/batch work and polls the batch workspace whenever any chapter has active analysis/audio state; it must not serialize jobs in React state. Narration worker concurrency remains bounded by worker/provider semaphores and is raised from one to two by default.

**Tech Stack:** React + TanStack Query + TypeScript, Spring backend durable generation jobs, Python asyncio narration worker, Docker Compose.

**Spec:** Approved in chat on 2026-08-28.

## Global Constraints

- Keep `chapters.order_index` zero-based; display chapter number as `orderIndex + 1`.
- Do not introduce a second client-side scheduler or queue.
- Preserve backend durable job admission and worker `SKIP LOCKED` claim semantics.
- Bound narration concurrency; default to 2 jobs and 2 VieNeu inference slots, not unbounded 10-20 way inference.
- Existing batch narration API is the preferred path for Generate Audio All.

---

### Task 1: Chapter ordering and UI contracts

**Files:**
- Modify: `app/desktop/src/renderer/features/chapters/model/chapter-ui.ts`
- Modify: `app/desktop/src/renderer/features/chapters/components/ChapterListPanel.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/screens/ChaptersScreen.tsx`
- Test: `app/desktop/test/chapter-parallel-processing-contracts.test.mjs`

**Interfaces:**
- Produces: `chapterNumberLabel(orderIndex: number): string`.

- [ ] Add failing tests for zero-based-to-display numbering and order-first UI defaults.
- [ ] Implement `chapterNumberLabel` and render it in the list.
- [ ] Default/reset sorting to `order`.
- [ ] Run desktop contract tests.

### Task 2: Remove cross-chapter narration lock and poll all active workspaces

**Files:**
- Modify: `app/desktop/src/renderer/features/chapters/queries/chapters.queries.ts`
- Modify: `app/desktop/src/renderer/features/chapters/screens/ChaptersScreen.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/components/ChapterEditorPanel.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/model/chapter-ui.ts`
- Test: `app/desktop/test/chapter-parallel-processing-contracts.test.mjs`

**Interfaces:**
- Consumes: workspace pipeline statuses and `chapterQueryKeys.workspaces`.
- Produces: batch workspace polling while any analysis/audio status is active.

- [ ] Add failing contract tests proving singular cross-chapter narration blocking is absent and batch polling covers analysis/audio processing.
- [ ] Remove `narrationJob` cross-chapter lock state and `blockedByAnotherChapter` UI state.
- [ ] Invalidate the relevant chapter workspace after single narration admission and rely on durable workspace status thereafter.
- [ ] Poll the workspace batch every 3 seconds while any chapter has active analysis/audio work.
- [ ] Run desktop contract tests.

### Task 3: Add Generate Audio All and Analyze All admission

**Files:**
- Modify: `app/desktop/src/renderer/features/chapters/components/ChapterListPanel.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/screens/ChaptersScreen.tsx`
- Test: `app/desktop/test/chapter-parallel-processing-contracts.test.mjs`

**Interfaces:**
- Consumes: existing `useGenerateBatchNarration`, `generationApi.analyze`, workspace capability/status.
- Produces: `onGenerateAudioAll` and `onAnalyzeAll` list actions.

- [ ] Add failing UI contract tests for bulk action labels/admission paths.
- [ ] Submit eligible chapter IDs through the existing batch narration API using the selected voice/rate.
- [ ] Submit eligible analyses concurrently with bounded client admission chunks; backend workers still own execution concurrency.
- [ ] Invalidate workspace/timeline queries after admissions and surface admitted/skipped counts.
- [ ] Run desktop contract tests.

### Task 4: Raise bounded narration concurrency defaults

**Files:**
- Modify: `docker-compose.yml`
- Test: `app/desktop/test/chapter-parallel-processing-contracts.test.mjs`

**Interfaces:**
- Produces defaults `NARRATION_WORKER_CONCURRENCY=2` and `VIENEU_INFERENCE_CONCURRENCY=2` while preserving env overrides.

- [ ] Add failing config contract assertions.
- [ ] Change Compose defaults from 1 to 2.
- [ ] Keep `WorkerSettings` bounds and provider semaphore unchanged.
- [ ] Run worker/config checks available in CI.

### Task 5: Verification

- [ ] Run desktop Node contract tests and TypeScript checks.
- [ ] Run AI-worker config/narration tests.
- [ ] Inspect diff for accidental backend schema changes.
- [ ] Verify no global UI lock prevents starting work on a different chapter.
