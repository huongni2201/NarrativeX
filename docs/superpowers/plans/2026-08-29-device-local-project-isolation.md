# Device-Local Project Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make project discovery device-local while keeping custom voice assets account-shared through R2, and remove the invalid remote/local branch from beat-media selection.

**Architecture:** Desktop local project catalog becomes authoritative for visible/openable projects on that installation. Backend remains durable orchestration state for projects created locally. Project media selection requires current-project availability; no remote/hybrid fallback is used for project visuals.

**Tech Stack:** Electron/React/TypeScript, Spring Boot, MyBatis XML, JUnit.

**Spec:** `docs/superpowers/specs/2026-08-29-device-local-project-isolation-design.md`

## Global Constraints

- Project data is not synchronized across Desktop installations.
- Custom voice/reference assets remain account-shared and R2-backed.
- Project media remains local-first and never falls back to R2.
- No compatibility layer is required for stale pre-release project-media data.

---

### Task 1: Enforce project-local beat media selection

**Files:**
- Modify: `app/backend-service/src/main/resources/mybatis/ProductionBeatMediaSelectionMapper.xml`
- Modify: `app/backend-service/src/test/java/com/narrativex/backend/architecture/ProductionBeatMediaSelectionScopeContractTest.java`

**Interfaces:**
- Consumes: `projectId`, `ownerId`, `mediaAssetId`
- Produces: selectable asset only when an AVAILABLE project-local materialization exists

- [ ] Replace the `storage_mode <> 'LOCAL_ONLY' OR ...` branch with an unconditional `EXISTS` check scoped to `project_id` and `media_asset_id`.
- [ ] Update the regression contract to assert the project-local EXISTS condition and to parse the mapper as XML so malformed XML fails the test.
- [ ] Run the targeted backend test and mapper/bootstrap verification.

### Task 2: Make Desktop local catalog authoritative for project visibility

**Files:**
- Modify: `app/desktop/src/renderer/features/projects/queries/projects.queries.ts`
- Add/update tests under the existing Desktop test layout if a project-query test file exists; otherwise rely on Desktop typecheck/check plus source contract assertions.

**Interfaces:**
- Consumes: `window.narrativex.localProjects.list()` and backend project create/detail APIs
- Produces: project list containing only projects registered in this Desktop installation

- [ ] Change list loading to return only local catalog entries and stop calling/reconciling the backend project list.
- [ ] Change detail loading to require the project to exist in the local catalog before consulting backend detail; fall back to local metadata only for that registered project.
- [ ] Keep create flow backend-first, then register/touch the project in the local catalog with `LOCAL_ONLY` sync status.
- [ ] Keep delete flow backend archive/delete plus local catalog hide.
- [ ] Run Desktop typecheck/check.

### Task 3: Update architecture docs and verify shared voice boundary

**Files:**
- Modify: `documentation/decisions/ADR-0012-desktop-local-first-media-and-render-execution.md`

**Interfaces:**
- Consumes: approved device-local project policy
- Produces: documentation consistent with ADR-0003 voice-only R2 boundary

- [ ] Remove the stale statement that R2 may be generated-project-media transport.
- [ ] State that different Desktop installations do not synchronize project workspaces/media; only account-owned custom voice/reference assets are shared through R2.
- [ ] Repository-search R2/project-media references and confirm no new project-media R2 path is introduced.

### Task 4: Final verification

- [ ] Verify mapper XML is well formed.
- [ ] Verify backend targeted tests/checks.
- [ ] Verify Desktop check/typecheck.
- [ ] Review branch diff for unrelated changes.
- [ ] Create PR with root cause, architecture change, and verification notes.
