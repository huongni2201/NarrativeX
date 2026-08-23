# Project Overview API Integration Report

> **Screen:** `01. Project Overview`  
> **Scope:** `app/frontend-web` + `app/backend-service`  
> **Rule:** Production UI must render backend-owned business data from real APIs. Missing capabilities must be shown as unavailable rather than simulated with hardcoded business values.

## 1. Current integration status

Project Overview is a real-API vertical slice for project metadata, overview metrics, story versions, chapters, project locations, project assets, authentication, and chapter batch import. The wider project shell also has real dashboard/favorite and project-scoped Character read foundations.

The frontend must not present hardcoded subscription tiers, credits, dates, production configuration, or continuity claims as if they came from the backend.

## 2. Implemented backend capabilities used by this area

| Method | Endpoint | Frontend status |
|---|---|---|
| `GET` | `/api/v1/projects` | Integrated |
| `GET` | `/api/v1/projects/dashboard` | Integrated in project dashboard |
| `PUT/DELETE` | `/api/v1/projects/{projectId}/favorite` | Integrated in project dashboard |
| `GET` | `/api/v1/projects/{projectId}` | Integrated |
| `GET` | `/api/v1/projects/{projectId}/overview` | Integrated |
| `GET` | `/api/v1/projects/{projectId}/stories/latest` | Integrated |
| `POST` | `/api/v1/projects/{projectId}/stories` | Integrated |
| `POST` | `/api/v1/projects/{projectId}/chapters` | Integrated |
| `POST` | `/api/v1/projects/{projectId}/chapters/batch-import` | Integrated |
| `GET` | `/api/v1/projects/{projectId}/characters` | Integrated in Project Characters tab |
| `GET` | `/api/v1/projects/{projectId}/characters/{characterId}` | Integrated in Character detail |
| `GET` | `/api/v1/projects/{projectId}/locations` | Integrated |
| `GET` | `/api/v1/projects/{projectId}/assets` | Integrated |
| `GET` | `/api/v1/users/me/quota` | Backend capability exists; UI wiring is separate |
| `GET` | `/api/v1/jobs/history` | Backend capability exists; UI wiring is separate |

Authentication and CSRF endpoints are handled by the shared frontend API client and session flow.

## 3. Project configuration

`GET /api/v1/projects/{projectId}` is the source of truth for `sourceLanguage`, `narrationLanguage`, `metadataLanguage`, `imageAspectRatio`, `imageQualityTier`, `status` and `rowVersion`. The frontend must not replace these fields with hardcoded `16:9`, `vi-VN`, or `STANDARD` values.

## 4. Chapters and batch import

Manual chapter creation uses `POST /api/v1/projects/{projectId}/chapters` with `Idempotency-Key`; `storyVersionId` and `orderIndex` are optional and are resolved server-side when omitted. Batch import uses `POST /api/v1/projects/{projectId}/chapters/batch-import` as multipart form data with optional `storyVersionId` and `file`. Both workflows ensure an active/latest StoryVersion transactionally; the frontend does not create StoryVersions as a prerequisite.

After chapter mutations the frontend invalidates the Project Overview and relevant chapter/story queries so the UI returns to backend truth.

## 5. Project Characters

Project-scoped Character list/detail is an authoritative read slice:

```http
GET /api/v1/projects/{projectId}/characters
GET /api/v1/projects/{projectId}/characters/{characterId}
```

The backend validates project ownership and returns project-context Character data including role, importance, aliases/groups, pinned version, appearance and scene count where available. Fields without an authoritative backend model remain explicitly unavailable instead of being fabricated.

## 6. Project locations

Project locations are read from `GET /api/v1/projects/{projectId}/locations`. Analysis also persists Location identities and Scene -> Location references as continuity foundations. Rich review/edit/reference workflows remain separate work.

## 7. Project assets

Project assets are read from `GET /api/v1/projects/{projectId}/assets`. The Project Overview Assets tab renders project-scoped assets from the backend instead of treating a global asset-library redirect as equivalent project data.

## 8. Continuity wording

Creating a chapter means the chapter belongs to the current Project and Story Version and uses persisted project configuration. Analysis persists Character/ProjectCharacter/Location continuity foundations and Scene relations, but this does not imply that every downstream Character Bible/Location Bible/reference-lock workflow is complete.

## 9. Remaining integration work

Frontend/product integration still includes quota UX, job-history UX, notifications, richer project-resource actions and richer Character relationship/asset/scene-detail reads when authoritative contracts exist.

Engineering work outside this screen currently includes:

- production user-audio upload/finalize/alignment hardening;
- aligned multi-part uploaded-audio slicing/stitching for render;
- narration-driven `VisualScenePlanner` and review workflow;
- richer image approval/reuse/reframe/edit lineage;
- publishing/entitlement hardening around the implemented owner-authorized preview/download/streaming proxy for Google Drive-backed FinalArtifacts;
- cross-attempt Drive upload retry without rerender;
- complete actual-usage/billing reconciliation;
- moderation/SSRF/retention/observability/DR hardening.

Do **not** list production Vertex image generation, IMAGE_MOTION chapter rendering, Google Drive final-video upload, or MyBatis migration as future capabilities: those foundations are already implemented.

## 10. Current media/storage context

Project Overview itself is not the render/export screen, but documentation around it must use the current storage contract:

```text
Images / narration / uploaded audio / reusable media -> R2
Final rendered MP4                              -> Google Drive
Metadata / lineage / job state                  -> PostgreSQL
```

The final video is not a validated R2 FinalArtifact anymore.

## 11. Definition of done

Project Overview is production-correct when business values come from backend APIs, Project metadata/configuration are authoritative, Chapters/Characters/Locations/Assets use project-scoped data, mutations invalidate affected queries, unavailable capabilities are explicit, and documentation matches actual contracts.

## 12. Summary

Project Overview should be described as a real-API integration over implemented backend capabilities. Future audits should distinguish between a missing backend capability, an implemented capability not yet wired into a screen, and an already-integrated end-to-end capability.
