# Backend Verify Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the complete backend `mvn verify` gate after PR #397 exposed accumulated baseline, fixture, and voice-reference integration drift.

**Architecture:** Preserve the PROJECT/ACCOUNT split: project media remains in `media_assets` and requires `project_id`; reusable account voice references remain in `voice_reference_assets`. Repair source adapters and stale tests against the authoritative seven-file Flyway baseline without reintroducing removed Google Drive metadata or deprecated job/status values.

**Tech Stack:** Java 25, Spring Boot, MyBatis, PostgreSQL/Testcontainers, JUnit 5, Mockito, ArchUnit, Flyway.

**Spec:** `documentation/plans/2026-08-29-project-account-voice-references.md`

## Global Constraints

- Keep PostgreSQL authoritative and retain the modular-monolith dependency direction.
- Keep project media device-local and account voice references R2-backed.
- Do not restore removed Google Drive persistence columns or deprecated enum values merely to satisfy fixtures.
- Treat CI run `33260071766`, job `99120378491`, as the initial RED reproduction because Maven Central is unavailable locally.

---

### Task 1: Voice-reference persistence boundary

**Files:**
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/assets/infrastructure/persistence/adapter/JdbcVoiceReferenceAssetRepository.java`
- Create/Modify: matching MyBatis mapper, row, and repository tests under the assets feature
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/GetVoiceReferenceAssetUseCase.java`

**Interfaces:**
- Consumes: `VoiceReferenceAssetRepository` and `VoiceReferenceAssetAccess` application ports.
- Produces: architecture-compliant persistence and inbound application boundaries.

- [ ] Add/adjust repository tests to reproduce account voice insertion and lookup failures.
- [ ] Verify the focused tests fail for the JDBC/MyBatis and argument-boundary mismatch shown by CI.
- [ ] Replace the forbidden JdbcTemplate adapter with the established MyBatis pattern and correct command argument handling.
- [ ] Run focused asset and architecture tests.

### Task 2: Authoritative schema and mapper alignment

**Files:**
- Modify: `app/backend-service/src/main/resources/mybatis/FinalArtifactMapper.xml`
- Modify: `app/backend-service/src/main/resources/mybatis/ProjectRenderArtifactMapper.xml`
- Modify: render snapshot mapper/migrations only where the production contract proves a missing authoritative column.
- Test: `app/backend-service/src/test/java/com/narrativex/backend/architecture/*`

**Interfaces:**
- Consumes: the current Flyway V1-V7 schema.
- Produces: mapper statements that bind and plan against a clean migrated PostgreSQL database.

- [ ] Use schema contract failures as RED tests for removed artifact columns and snapshot naming.
- [ ] Update mappers/models to the local-artifact schema rather than restoring deprecated Drive fields.
- [ ] Re-run schema, Flyway, and ArchUnit contract tests.

### Task 3: Stale fixtures and unit-test integrations

**Files:**
- Modify: failing tests reported by CI under `feature/render`, `feature/storyboard`, `feature/generation`, `feature/assets`, and `feature/auth`.
- Modify production code only when the focused test proves a real behavior regression.

**Interfaces:**
- Consumes: current domain enums, current method signatures, and required project/account ownership.
- Produces: deterministic tests using valid `RENDER_PROJECT`/review-status/schema values and current Mockito argument positions.

- [ ] Update one failing fixture group at a time and preserve each test's behavioral assertion.
- [ ] Correct Mockito stubs to the current signatures; do not weaken strictness globally.
- [ ] Fix true controller/domain regressions only after a focused RED assertion identifies them.
- [ ] Run each affected test class after its smallest change.

### Task 4: Full verification and follow-up PR

**Files:**
- Modify: this plan checklist with verification evidence if documentation drift requires it.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: a pushed follow-up branch and PR against `main`.

- [ ] Run `./mvnw --batch-mode --no-transfer-progress verify` when dependencies are available.
- [ ] Run Repository gates, Desktop check, AI worker tests/Ruff/Mypy to detect cross-component regression.
- [ ] Review the final diff for unrelated changes and secrets.
- [ ] Commit, push `fix/backend-verify-after-voice-scope-cutover`, create the follow-up PR, and inspect its CI jobs.
