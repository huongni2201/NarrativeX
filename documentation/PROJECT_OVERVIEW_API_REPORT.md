# Project Overview API Integration Report

> **Screen:** `01. Project Overview`  
> **Scope:** `app/frontend-web` + `app/backend-service`  
> **Rule:** Production UI must render backend-owned business data from real APIs. Missing capabilities must be shown as unavailable rather than simulated with hardcoded business values.

## 1. Current integration status

Project Overview is a real-API vertical slice for project metadata, overview metrics, story versions, chapters, project locations, project assets, authentication, and chapter batch import.

The frontend must not present hardcoded subscription tiers, credits, dates, production configuration, or continuity claims as if they came from the backend.

## 2. Implemented backend capabilities used by this area

| Method | Endpoint | Frontend status |
|---|---|---|
| `GET` | `/api/v1/projects` | Integrated |
| `GET` | `/api/v1/projects/{projectId}` | Integrated |
| `GET` | `/api/v1/projects/{projectId}/overview` | Integrated |
| `GET` | `/api/v1/projects/{projectId}/stories/latest` | Integrated |
| `POST` | `/api/v1/projects/{projectId}/stories` | Integrated |
| `POST` | `/api/v1/projects/{projectId}/chapters` | Integrated |
| `POST` | `/api/v1/projects/{projectId}/chapters/batch-import` | Integrated |
| `GET` | `/api/v1/projects/{projectId}/locations` | Integrated |
| `GET` | `/api/v1/projects/{projectId}/assets` | Integrated |
| `GET` | `/api/v1/users/me/quota` | Backend capability exists; UI wiring is separate |
| `GET` | `/api/v1/jobs/history` | Backend capability exists; UI wiring is separate |

Authentication and CSRF endpoints are handled by the shared frontend API client and session flow.

## 3. Project configuration

`GET /api/v1/projects/{projectId}` is the source of truth for:

- `sourceLanguage`
- `narrationLanguage`
- `metadataLanguage`
- `imageAspectRatio`
- `imageQualityTier`
- `status`
- `rowVersion`

The frontend must not replace these fields with hardcoded `16:9`, `vi-VN`, or `STANDARD` values.

## 4. Chapters and batch import

Manual chapter creation uses:

```http
POST /api/v1/projects/{projectId}/chapters
```

Batch import uses:

```http
POST /api/v1/projects/{projectId}/chapters/batch-import
Content-Type: multipart/form-data
```

The multipart request includes:

- `storyVersionId`
- `file`

After chapter mutations the frontend invalidates the Project Overview and relevant chapter/story queries so the UI returns to backend truth.

## 5. Project locations

Project locations are read from:

```http
GET /api/v1/projects/{projectId}/locations
```

The Project Overview Locations tab renders the real project-scoped response. It must not describe this endpoint as unfinished or substitute global-library placeholder content.

## 6. Project assets

Project assets are read from:

```http
GET /api/v1/projects/{projectId}/assets
```

The Project Overview Assets tab renders project-scoped assets from the backend instead of treating a global asset library redirect as equivalent project data.

## 7. Continuity wording

Creating a chapter means the chapter belongs to the current Project and Story Version and uses the persisted project configuration.

The UI must not claim that Character Bible, Location Bible, Outfit, Voice, Visual, or other continuity resources are automatically inherited or snapshotted unless the corresponding backend workflow explicitly guarantees and persists that behavior.

## 8. Remaining integration work

The following items are not backend gaps; they are frontend/product integration work:

- render user quota/entitlement information from `/api/v1/users/me/quota` where product UX requires it;
- expose job history from `/api/v1/jobs/history` in the appropriate history/observability screen;
- connect notification APIs to notification UX where applicable;
- improve project resource management actions beyond read-only Project Overview rendering.

The following engineering work remains outside this screen:

- PostgreSQL worker integration and concurrency/recovery tests;
- location materialization and scene-to-character/location continuity persistence in worker output;
- safe Vertex retry/reconciliation semantics for ambiguous provider outcomes;
- larger storyboard pagination/virtualization and performance work.

## 9. Definition of done

Project Overview is considered production-correct when:

- business values come from backend APIs rather than hardcoded production-looking values;
- Project metadata and configuration come from Project APIs;
- Overview metrics and chapter summaries come from Project Overview;
- manual chapter creation and batch import call real backend endpoints;
- Locations and Assets render real project-scoped API data;
- mutations invalidate affected queries;
- unavailable capabilities are represented explicitly;
- documentation matches the actual backend/frontend contract.

## 10. Summary

Project Overview should be described as a **real-API integration over implemented backend capabilities**, not as a mock-first UI and not as a screen where existing APIs are still considered roadmap items.

Future audits should distinguish between:

1. backend capability missing;
2. backend capability implemented but not yet wired into a specific frontend screen;
3. backend capability already integrated end to end.
