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

## 5. Project Characters

Project-scoped Character list/detail is now an authoritative E2E read slice:

```http
GET /api/v1/projects/{projectId}/characters
GET /api/v1/projects/{projectId}/characters/{characterId}
```

The backend validates project ownership and returns project-context Character data including role, importance, aliases/groups, pinned version, appearance and scene count where available. The frontend no longer substitutes demo Character profile/visual/scene metrics for those fields.

Fields without an authoritative backend model — such as relationship graphs, rich scene detail, avatar/asset aggregates — remain explicitly unavailable instead of being fabricated.

## 6. Project locations

Project locations are read from:

```http
GET /api/v1/projects/{projectId}/locations
```

The Project Overview Locations tab renders the real project-scoped response. It must not describe this endpoint as unfinished or substitute global-library placeholder content.

AI analysis also persists project Location identities and Scene -> Location references as continuity foundations. Rich review/edit/reference workflows remain separate work.

## 7. Project assets

Project assets are read from:

```http
GET /api/v1/projects/{projectId}/assets
```

The Project Overview Assets tab renders project-scoped assets from the backend instead of treating a global asset library redirect as equivalent project data.

## 8. Continuity wording

Creating a chapter means the chapter belongs to the current Project and Story Version and uses the persisted project configuration.

Analysis currently persists Character/ProjectCharacter/Location continuity foundations and Scene relations. This still does **not** mean Character Bible, Location Bible, Outfit, Voice, Visual, approved references, or locked snapshots are automatically inherited for every downstream media operation unless the corresponding workflow explicitly guarantees and persists that behavior.

## 9. Remaining integration work

The following items are not backend gaps; they are frontend/product integration work:

- render user quota/entitlement information from `/api/v1/users/me/quota` where product UX requires it;
- expose job history from `/api/v1/jobs/history` in the appropriate history/observability screen;
- connect notification APIs to notification UX where applicable;
- improve project resource management actions beyond current read-focused Project Overview rendering;
- add richer Character relationship/asset/scene-detail reads only when backend contracts become authoritative.

The following engineering work remains outside this screen:

- production user-audio upload/finalize/alignment hardening;
- narration-driven VisualScenePlanner;
- production image generation and immutable image MediaAsset lifecycle;
- IMAGE_MOTION render/export and validated R2 FinalArtifact;
- complete actual usage/billing reconciliation;
- preservation of the completed MyBatis-only production boundary;
- larger storyboard pagination/virtualization and performance work.

Location materialization and Scene-to-Character/Location continuity persistence are **not** listed as future work anymore; their foundations are already merged.

## 10. Definition of done

Project Overview is considered production-correct when:

- business values come from backend APIs rather than hardcoded production-looking values;
- Project metadata and configuration come from Project APIs;
- Overview metrics and chapter summaries come from Project Overview;
- manual chapter creation and batch import call real backend endpoints;
- Characters, Locations and Assets render project-scoped authoritative API data where contracts exist;
- mutations invalidate affected queries;
- unavailable capabilities are represented explicitly;
- documentation matches the actual backend/frontend contract.

## 11. Summary

Project Overview should be described as a **real-API integration over implemented backend capabilities**, not as a mock-first UI and not as a screen where existing APIs are still considered roadmap items.

Future audits should distinguish between:

1. backend capability missing;
2. backend capability implemented but not yet wired into a specific frontend screen;
3. backend capability already integrated end to end.
