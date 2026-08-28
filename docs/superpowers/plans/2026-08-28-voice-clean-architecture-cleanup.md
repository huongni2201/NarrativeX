# Voice Clean Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the next renderer migration tranche by removing proven-unused compatibility code and moving Voice screen transport/native workflows behind feature query/model boundaries without changing UI behavior or public contracts.

**Architecture:** Keep the approved feature structure from `2026-08-28-desktop-renderer-clean-architecture-design.md`: screens compose state and callbacks, queries own React Query/cache/native workflows, and model files remain pure. This tranche is intentionally limited to Voice plus the previously proven safe legacy cleanup; Images/Assets/Production remain separate follow-ups.

**Tech Stack:** Electron, React 19, TypeScript, TanStack Query, Node test runner, Java/Spring.

**Spec:** `docs/superpowers/specs/2026-08-28-desktop-renderer-clean-architecture-design.md`

## Global Constraints

- Preserve current UI layout, wording, route behavior, backend contracts and preload contracts.
- Do not move filesystem/process/provider-native responsibilities out of Electron main; renderer queries may invoke only existing typed preload capabilities.
- React Query remains authoritative for server state.
- Do not remove compatibility code unless repository callers and current docs prove it unused.
- Do not mix Images, Assets-screen or Production-screen cleanup into this PR.

---

### Task 1: Add Voice feature-boundary characterization

**Files:**
- Modify: `app/desktop/test/feature-boundaries.test.mjs`

**Interfaces:**
- Consumes: current `VoiceScreen.tsx` source.
- Produces: a regression guard requiring Voice screen to delegate raw transport/cache/native workflows.

- [ ] **Step 1: Write the failing source-level test**

Assert that `VoiceScreen.tsx` does not import `useQuery`, `useQueryClient`, `assetsApi` or `narrationApi`, does not call `window.narrativex.localStorage.selectAsset/commitSelectedAsset`, and instead composes `useVoiceReferenceAsset`, `useVoicePreviewResult`, `useImportVoiceAudioAsset`, and `useUploadVoiceReference`.

- [ ] **Step 2: Verify RED**

Run `node --test test/feature-boundaries.test.mjs` under `app/desktop`. Expected before implementation: the Voice boundary test fails because the current screen owns these workflows inline.

### Task 2: Move pure Voice filter helpers under model

**Files:**
- Create: `app/desktop/src/renderer/features/voices/model/voice-filters.ts`
- Modify: `app/desktop/src/renderer/features/voices/components/VoiceFiltersBar.tsx`
- Modify: `app/desktop/src/renderer/features/voices/screens/VoiceScreen.tsx`
- Modify: `app/desktop/test/chapter-voice-contracts.test.mjs`
- Delete: `app/desktop/src/renderer/features/voices/voice-filters.ts`

**Interfaces:**
- Produces: `VoiceSortMode`, `VoiceFilters`, `filterVoices`, `uniqueVoiceValues`, `playableSampleUrl` from `voices/model/voice-filters.ts` with unchanged behavior.

- [ ] **Step 1: Update tests/imports to the canonical model path**
- [ ] **Step 2: Move the helper file without behavior changes**
- [ ] **Step 3: Run `node --test test/chapter-voice-contracts.test.mjs`**

### Task 3: Extract Voice query/native workflows

**Files:**
- Create: `app/desktop/src/renderer/features/voices/queries/voice-media.queries.ts`
- Create: `app/desktop/src/renderer/features/voices/queries/voice-media.mutations.ts`
- Modify: `app/desktop/src/renderer/features/voices/screens/VoiceScreen.tsx`
- Test: `app/desktop/test/voice-media-workflow.test.mjs`

**Interfaces:**
- Produces: `useVoiceReferenceAsset(assetId)`, `useVoicePreviewResult(projectId, jobId, enabled)`, `useImportVoiceAudioAsset(projectId)`, `useUploadVoiceReference()`.
- Pure mutation helper `persistVoiceAudioAsset(deps, input)` validates `AUDIO`, enforces 50 MiB, registers local metadata, commits the selection token, and returns the imported asset plus selection metadata.

- [ ] **Step 1: Write failing tests for audio import workflow validation/order**
- [ ] **Step 2: Verify RED**
- [ ] **Step 3: Implement the pure workflow and React Query wrappers**
- [ ] **Step 4: Replace raw `VoiceScreen` imports/calls with the hooks while preserving notice text and busy semantics**
- [ ] **Step 5: Run Voice workflow and boundary tests**

### Task 4: Carry forward proven safe legacy cleanup

**Files:**
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/port/out/GenerationJobRepository.java`
- Delete: `app/desktop/src/renderer/App.tsx`
- Modify: `app/desktop/src/renderer/main.tsx`
- Delete: `app/desktop/src/renderer/features/generation/media-review-policy.ts`
- Delete: `app/desktop/test/media-review-policy.test.mjs`
- Create: `app/desktop/test/legacy-cleanup.test.mjs`

**Interfaces:**
- Preserve owner-scoped generation repository methods and direct `DesktopApp` renderer entry.

- [ ] **Step 1: Reconfirm no production caller uses the deprecated one-argument generation repository shims or media-review-policy exports**
- [ ] **Step 2: Apply only the proven-unused removals**
- [ ] **Step 3: Run source-level cleanup guards**

### Task 5: Verification and PR

**Files:** no new runtime files.

- [ ] **Step 1: Run Desktop `npm test`, `npm run type-check`, and `npm run build` in a capable environment**
- [ ] **Step 2: Run backend tests/compile covering `GenerationJobRepository`**
- [ ] **Step 3: Compare branch to latest `main` and ensure it is not behind**
- [ ] **Step 4: Create the PR with scope, behavior-preservation notes, and exact verification evidence**
