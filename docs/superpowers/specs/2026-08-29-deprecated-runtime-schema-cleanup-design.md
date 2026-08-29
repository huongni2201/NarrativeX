# Deprecated Runtime and Schema Cleanup Design

**Status:** Approved for implementation  
**Date:** 2026-08-29  
**Base:** `main` at `b411c40ec04338efa4a2b0413b4b20b234161153`

## Goal

Remove deprecated runtime, persistence, test and documentation residue that no longer belongs to the current NarrativeX architecture, including obsolete database baseline fields, while preserving the current `VIDEO` selection and all intentional web/browser-based video-generation paths.

## Non-negotiable constraints

1. Keep `VisualGenerationMode = IMAGE | VIDEO` end to end where it represents current analysis/editor intent.
2. Keep the Analyze Chapter UI option for `VIDEO`.
3. Keep current and planned web/browser automation used to generate video; do not infer that VIDEO is dead merely because the API image job accepts only `IMAGE + IMAGE_MOTION`.
4. Final project rendering remains Electron-main FFmpeg/ffprobe under backend assignment/lease control.
5. Final MP4 bytes remain Desktop-local. Backend final-artifact persistence is metadata-only.
6. Generated/imported project images, narration/audio and imported video are project-local in current flows. R2 is reserved for authenticated account-owned voice-reference/custom-voice storage.
7. NarrativeX has not had its first production deployment, so Flyway V1-V8 may be rewritten to a clean final baseline instead of adding compatibility migrations.
8. Do not remove a candidate only because its name looks old. Remove it only after verifying there is no current producer, executor, caller, API requirement or accepted product requirement.
9. Regression guards that prevent deleted architecture from returning are not dead tests and should remain or be strengthened.

## Cleanup scope

### 1. Final artifact persistence hard cutover

The final-artifact model must describe a Desktop-local final output and not retain remote-final-video provider residue.

Remove from the clean baseline and backend persistence path when no current caller requires them:

- `final_artifacts.external_file_id`;
- `final_artifacts.web_view_link`;
- the `idx_final_artifacts_external_file_id` index;
- the legacy `storage_provider DEFAULT 'R2'` assumption;
- Java DTO/store compatibility arguments for `externalFileId` and `webViewLink`;
- compatibility overloads that infer remote storage from a non-null storage key.

`storage_provider` may remain only if it is still useful as explicit metadata for the current local artifact contract. If retained, the clean baseline default and all current project-render writes must be `LOCAL_DESKTOP`; otherwise remove it together with all callers/tests. Prefer the smallest model that still serves real reads.

### 2. R2/storage contract cleanup

Current project media is local. R2 is not generated-image/narration transport in the current architecture. Align active documentation, configuration comments and guards to:

```text
Generated/imported project image/audio/video -> project-local workspace/shared project-local staging
Final MP4                                  -> Desktop local project artifacts
Voice reference/custom voice               -> R2 when account-owned remote storage is required
Business/job/artifact metadata              -> PostgreSQL
```

Historical implementation plans may remain as history if clearly marked as such; maintained source-of-truth/product/architecture/workflow docs must not state the retired generated-media R2 contract.

### 3. Worker compatibility shim cleanup

Remove compatibility aliases/settings only when their remaining production callers can be migrated in the same change without changing behavior. In particular, migrate narration internals away from aliases such as `media_local_dir`/`media_storage_mode` to the canonical project-local setting before deleting the aliases. Preserve active pricing/config values that still have production consumers.

### 4. Job/enumeration cleanup

Audit generation job/resource/production enums and schema checks against current producers/executors.

Current known required values include at least:

- `CHAPTER_ANALYZE`;
- `NARRATION_GENERATE`;
- `CHAPTER_GENERATE` / `SHOT_IMAGE_GENERATE` where used by the current media job path;
- `RENDER_PROJECT` for backend-authorized local project render;
- job types proven by current API/worker code during implementation.

Candidates such as `STORY_ANALYZE`, `IMAGE_GENERATE`, `CHAPTER_RENDER`, `PROJECT_CONTINUE`, `VISUAL_BEAT_PLAN`, `RENDER_SHORT` must be removed only if repository-wide evidence shows they have no current producer/executor/caller and no accepted active requirement.

The same rule applies to `ResourceClass` values and old render execution targets.

### 5. Media plan / I2V cleanup boundary

Do not delete `VIDEO` analysis/editor intent or web-video logic.

`HYBRID_LOCAL_I2V` and provider-side I2V runtime residue may be removed from current executable/schema paths if they have no current executor. Product documentation may retain provider-neutral I2V as deferred roadmap intent, but current runtime/schema must not pretend an executor exists.

### 6. Cloud/server render cleanup

ADR-0012 is authoritative: there is no server-side final-render executor or remote final-video fallback. Remove current-code branches that still authorize `RenderExecutionTarget.CLOUD`, cloud render costs/stage naming, or cloud-only media validation if no current public API can legitimately use them. Keep `LOCAL_DEVICE` as the only final-project-render execution target.

### 7. Tests and guards

Use tests to distinguish supported behavior from legacy behavior:

- preserve VIDEO/web-video contract tests;
- add/strengthen guards that removed remote final-video fields and cloud render targets cannot reappear;
- rewrite tests that exist only to exercise removed compatibility overloads;
- retain architecture/legacy cleanup tests that guard the new boundary.

### 8. Documentation

Synchronize maintained docs, including as applicable:

- `README.md`;
- `AI_CONTEXT.md`;
- `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`;
- `documentation/product/PRODUCT_SPEC.md`;
- `documentation/product/FEATURE_CATALOG.md`;
- `documentation/architecture/SYSTEM_ARCHITECTURE.md`;
- `documentation/architecture/DATA_FLOW.md`;
- `documentation/architecture/SERVICE_BOUNDARIES.md`;
- `documentation/codebase/AI_WORKER_CODEBASE.md`;
- `documentation/decisions/ADR-0003-media-storage-generation-pipelines-and-external-integrations.md`;
- docs-drift guards.

Do not rewrite completed historical plans merely to make them look current unless a maintained doc links to them as current truth.

## Validation

The change is complete only when the exact branch head passes:

- Repository gates;
- Backend verify;
- Desktop check;
- AI worker checks.

In addition, repository searches on the exact head must show no unexpected runtime/schema references to removed fields/targets, while `VIDEO` and web-video support remain present.