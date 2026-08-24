# Project Overview API Integration Report

> **Primary client:** `app/desktop`  
> **Backend:** `app/backend-service`  
> **Legacy reference:** `app/frontend-web` remains temporarily during migration.  
> **Rule:** UI must render backend-owned business data from real APIs; machine-local media paths stay behind Electron main/preload.

## 1. Current integration status

Project Overview is a backend-authoritative slice for project metadata, overview metrics, story versions, chapters, characters, locations and project asset identities.

The Desktop migration reuses backend contracts but changes the client/media boundary:

- `app/desktop` is the primary UI target;
- backend APIs remain the durable metadata authority;
- local project bytes are resolved by Electron main through the project manifest;
- `app/frontend-web` is a legacy parity reference, not the target architecture.

The UI must not fabricate subscription tiers, credits, dates, production configuration, continuity state or local file availability.

## 2. Backend capabilities used by this area

| Method | Endpoint | Status / Desktop direction |
|---|---|---|
| `GET` | `/api/v1/projects` | authoritative project list |
| `GET` | `/api/v1/projects/dashboard` | authoritative dashboard data |
| `PUT/DELETE` | `/api/v1/projects/{projectId}/favorite` | project favorite mutation |
| `GET` | `/api/v1/projects/{projectId}` | authoritative project configuration |
| `GET` | `/api/v1/projects/{projectId}/overview` | authoritative overview |
| `GET` | `/api/v1/projects/{projectId}/stories/latest` | latest StoryVersion read |
| `POST` | `/api/v1/projects/{projectId}/stories` | story mutation |
| `POST` | `/api/v1/projects/{projectId}/chapters` | chapter creation |
| `POST` | `/api/v1/projects/{projectId}/chapters/batch-import` | chapter import |
| `GET` | `/api/v1/projects/{projectId}/characters` | project Character read |
| `GET` | `/api/v1/projects/{projectId}/characters/{characterId}` | Character detail |
| `GET` | `/api/v1/projects/{projectId}/locations` | project Location read |
| `GET` | `/api/v1/projects/{projectId}/assets` | project asset identity/metadata |
| `GET` | `/api/v1/users/me/quota` | quota read |
| `GET` | `/api/v1/jobs/history` | job-history read |

Desktop authentication uses the shared backend Google-OAuth/session contracts described by ADR-0011 rather than password authentication.

## 3. Project configuration

`GET /api/v1/projects/{projectId}` remains authoritative for project configuration such as source/narration/metadata language, image aspect/quality, status and row version.

Desktop UI must not replace those values with hardcoded defaults that look authoritative.

## 4. Chapters and import

Chapter creation/batch import remains backend-authoritative and idempotent where defined. Desktop may use native file selection for source/import UX, but durable StoryVersion/Chapter orchestration remains server-side.

After mutations, Desktop query state must be invalidated/refetched rather than treating optimistic renderer state as durable truth.

## 5. Characters and locations

Project-scoped Character/Location reads remain backend-owned. Desktop can present richer editor interactions, but missing authoritative fields must be shown as unavailable rather than filled with production-looking fixtures.

## 6. Project assets under the Desktop migration

The backend asset API describes stable asset identity/metadata. For Desktop-local project media, the actual byte location is resolved through:

```text
backend assetId + expected integrity
  -> Electron preload/main
  -> project.manifest.json
  -> checksum-verified local project file
```

Do not persist or return absolute local paths as domain identifiers.

A backend asset may temporarily still refer to cloud-backed media during migration. Desktop should make local/cloud availability explicit rather than silently assuming every backend asset has already been materialized locally.

## 7. Authentication

Google is the only user-facing login provider.

```text
Desktop -> system browser -> Google OIDC
        -> narrativex:// one-time handoff
        -> backend exchange
        -> server-managed NarrativeX session
```

The local execution device token is separate from the user session and is not a replacement user auth model.

## 8. Render/export context

Project Overview is not itself the render engine, but related documentation must use the correct storage/execution boundary.

### Desktop primary

```text
project media        -> local project workspace
final local MP4      -> local project artifacts
metadata/job state   -> PostgreSQL
```

### Cloud/legacy fallback

```text
cloud pipeline media -> R2
cloud final MP4      -> Google Drive
metadata/job state   -> PostgreSQL
```

Do not describe R2/Drive as mandatory Desktop project storage.

## 9. Remaining Desktop integration work

- complete project screen/action parity;
- complete local materialization/registration for generated/imported assets;
- richer Character/location/asset editing flows;
- restart-safe local render recovery;
- disk/backup/move/repair UX;
- remove legacy web dependencies after parity gates.

## 10. Definition of done

Project Overview is production-correct when:

- all business values come from backend-authoritative contracts;
- Desktop is the primary client implementation;
- local project bytes are resolved only through the secure Electron local-storage boundary;
- unavailable/local-missing/cloud-only states are explicit;
- mutations return to backend truth;
- docs do not confuse the cloud fallback path with the Desktop local-first path.
