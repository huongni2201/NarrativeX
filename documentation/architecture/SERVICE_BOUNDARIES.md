# NarrativeX Service and Module Boundaries — V1.12

NarrativeX uses one Spring Boot modular monolith, separately executed Python worker roles and one Electron Desktop editor. These are ownership boundaries, not microservices for their own sake.

## Desktop renderer

Owns presentation only: routes/screens, React Query state, editor/timeline drafts, preview/inspector interactions and explicit typed preload calls. It does not own credentials, filesystem/process access, FFmpeg execution or durable policy.

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
| voice references | PROJECT/ACCOUNT scope validation and account voice catalog ownership/readiness |
| generation | admission, GenerationJob/StageAttempt/ProviderOperation, MediaPlan where applicable |
| production timeline | source-range/narration alignment mapping + exact render-readiness + explicit beat media selection |
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

Workers own provider mechanics, validation and durable claim/reconciliation. Analysis/materialization resolves VisualBeat source anchors to deterministic UTF-16 source ranges. Narration owns audio/alignment generation. The backend production-timeline layer owns source-range-to-audio mapping.

Workers do not execute final project renders and do not host a current VIDEO/I2V provider role.

## Storage boundaries

```text
Generated project image/audio        -> project-local media -> Desktop ProjectStorage
Imported project image/audio/video   -> Desktop ProjectStorage
PROJECT voice reference              -> project-local media / project.manifest.json
Render work/cache                    -> Desktop workspace/work
Final MP4                            -> Desktop workspace/artifacts
ACCOUNT voice reference/custom voice -> Cloudflare R2
Business/job/artifact metadata       -> PostgreSQL
```

R2 is not a transport layer for generated project images/narration and is not final-video storage. PROJECT voice references never require R2 storage metadata.

## Timing boundary

```text
AI worker: source_anchor -> UTF-16 textStart/textEnd
Narration: source/alignment spans + authoritative encoded audio duration
Backend: text ranges + narration alignment -> production beat audio clock
Desktop: consume backend-authorized timeline for preview/render
```

Complete persisted beat audio spans remain compatibility input. Provisional fallback timing is review-only and cannot satisfy final render admission.

## Final-render boundary

The only final project render executor is Electron main under backend authorization/lease. Former server/cloud and Chapter-render executor paths are removed.

## Persistence

Production persistence uses MyBatis + explicit PostgreSQL SQL. Flyway V1–V8 is the clean pre-production baseline. After first production deployment, future changes become append-only.
