# NarrativeX Service and Module Boundaries — V1.12

NarrativeX uses one Spring Boot modular monolith, separately executed Python worker roles and one Electron Desktop editor. These are ownership boundaries, not microservices for their own sake.

## Desktop renderer

Owns presentation only:

- routes/screens;
- React Query state;
- editor/timeline drafts;
- preview/inspector interactions;
- explicit typed preload calls.

It does not own credentials, filesystem/process access, FFmpeg execution or durable policy.

## Preload

Exposes narrow task-specific capabilities. Never expose arbitrary Node.js, filesystem, environment or process primitives.

## Electron main

Owns privileged Desktop behavior:

- guest credential and backend session transport;
- Google OAuth/deep-link handling;
- native file/folder selection and hashing;
- ProjectStorage/ProjectCatalog and local manifest;
- backup/restore/storage verification;
- Chrome/CDP web-provider automation for supported image/video generation workflows;
- protected local-device identity;
- render assignment/claim/lease/progress/failure/completion;
- FFmpeg/ffprobe, render journal/cache and final-artifact operations.

## Backend

| Area | Responsibility |
|---|---|
| auth/account | guest continuity, Google-linked account, server session, ownership transfer |
| project/storyboard | Project/Chapter/Scene/VisualBeat source and review state |
| assets | stable MediaAsset identity/checksums/storage mode/lineage |
| generation | admission, GenerationJob/StageAttempt/ProviderOperation, MediaPlan for executable image work |
| production timeline | narration-aligned timing + explicit beat media selection |
| local execution | device enrollment, assignment, claim/lease/progress/terminal state |
| render metadata | immutable project render snapshots + FinalArtifact metadata |
| notification | durable user notification state |
| common | shared primitives/API envelopes only |

The backend never persists absolute Desktop project paths and never stores/proxies final MP4 bytes.

## Python worker

Current roles:

```text
analysis
narration
media-validation
image-generation
```

Workers own provider mechanics, validation and durable claim/reconciliation. They do not execute final project renders and do not host a current VIDEO/I2V provider role.

`VIDEO` remains a supported analysis/editor intent for Electron web/browser generation and mixed-media production; do not remove that intent when cleaning Python provider residue.

## Storage boundaries

```text
Generated project image/audio   -> project-local media -> Desktop ProjectStorage
Imported project image/audio/video -> Desktop ProjectStorage
Render work/cache               -> Desktop workspace/work
Final MP4                       -> Desktop workspace/artifacts
Voice reference/custom voice    -> R2 when account remote storage is required
Business/job/artifact metadata  -> PostgreSQL
```

R2 is not a transport layer for generated project images/narration and is not final-video storage.

## Final-render boundary

The only final project render executor is Electron main under backend authorization/lease. Former server/cloud and Chapter-render executor paths are removed.

## Persistence

Production persistence uses MyBatis + explicit PostgreSQL SQL. Flyway V1–V8 is the clean pre-production baseline. After first production deployment, future changes become append-only.
