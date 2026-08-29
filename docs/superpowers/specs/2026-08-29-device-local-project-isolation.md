# Device-Local Project Isolation Design

Date: 2026-08-29
Status: approved design, pre-release hard cutover

## Goal

NarrativeX treats every project and every project-owned media asset as device-local data. Signing into the same account on another device does not synchronize, discover, or reuse projects or project media from another device. The only cross-device media is the account-owned custom voice/reference library, whose bytes remain in R2.

The implementation must remove fields, enums, tables, and branches that only encode facts which are now always true. In particular, project-local data must not carry a `LOCAL_ONLY`/`PROJECT_LOCAL` storage-mode enum merely to say that it is local, and custom voice data must not carry a `project_id` merely to say that it is account-scoped.

## 1. Project visibility and ownership

The Desktop local project catalog is authoritative for which projects are visible and openable on that installation.

Backend project records remain durable orchestration/business state for a project created on that device, but the Desktop never imports arbitrary backend project lists into the local catalog. A project ID absent from the local catalog is treated as unavailable on that device, and project-scoped workspace queries must remain disabled until the local registration check succeeds.

Creating a project remains backend-first because analysis/generation/render orchestration requires a durable backend project ID. After creation succeeds, Desktop registers the project in its own local catalog and creates/uses the local workspace.

The local project catalog contains only actual local-project metadata. It does not contain cloud synchronization metadata.

Remove these concepts from the local project catalog and bridge contracts:

- `cloudProjectId`;
- `syncStatus`;
- `LOCAL_ONLY`;
- `DIRTY`;
- `SYNCING`;
- `SYNCED`;
- `SYNC_FAILED`;
- `ORPHANED`;
- backend-list reconciliation APIs.

Archiving/deleting a project is represented directly as local catalog lifecycle state or physical removal policy, not as a fake synchronization status.

## 2. Project media ownership

Every project image, narration asset, imported media asset, generated video input, and other project-owned media row has direct project ownership in PostgreSQL:

```text
media_assets.project_id -> projects.id
```

For project media, `project_id` is mandatory.

Project-media selection and project asset-library queries use direct ownership:

```sql
ma.account_id = :ownerId
AND ma.project_id = :projectId
AND ma.status = 'READY'
```

Visual selection additionally restricts the media type as required by the feature.

`local_media_materializations` must not be used to infer project ownership. The current table has no reliable runtime writer for this purpose, and project ownership belongs on the asset itself. If no remaining independent device-materialization feature requires the table after the cutover, remove it and its indexes/mappers/tests.

## 3. Remove project-media storage-mode polymorphism

Project media is always local in the current product architecture. Therefore project-media code must not branch on these values:

- `LOCAL_ONLY`;
- `PROJECT_LOCAL`;
- `REMOTE`;
- `HYBRID`.

If `storage_mode` has no remaining multi-valued business meaning after separating custom voice/reference storage, remove the column and corresponding enums/contracts entirely rather than replacing it with a one-value enum.

Desktop preview/render resolution for project media uses project identity plus local manifest/storage metadata. It must not request an R2/download URL fallback merely because a storage-mode field is absent.

Backend may still expose short-lived local capability URLs for worker-to-Desktop handoff where bytes are produced in the shared local runtime before Desktop materializes them. Those URLs are transport over local/shared storage; they are not remote/R2 project storage and do not justify a project-media storage-mode enum.

## 4. Registering local project media

`POST /api/v1/assets/local` (or its replacement project-scoped endpoint) carries `projectId` to the backend.

Backend validates that:

- the current account owns the project;
- the asset type is valid project media;
- size/checksum metadata is valid.

Backend then creates the media row with direct `project_id` ownership.

The current client contract intentionally strips `projectId` before sending the request; that behavior must be removed because project ownership is now durable backend metadata.

## 5. Generated project media and deduplication

AI workers already know the generation job's `project_id`. When materializing generated image/media rows they write that value directly to `media_assets.project_id`.

Project media must not be deduplicated across different projects merely because `(account_id, sha256)` matches. Two projects may contain identical bytes while still owning independent project media identities.

Any checksum registry/reuse policy must therefore either:

- include `project_id` for project media; or
- be reserved for genuinely account-scoped reusable assets such as custom voice/reference assets.

The preferred pre-release cutover is to avoid cross-project project-media reuse entirely.

## 6. Custom voice/reference assets

Custom voice/reference data is account-level, not project-level.

Its model/API/storage must not contain `projectId` or `project_id`. The current `/api/v1/voice-references` upload flow is already account-oriented and remains the correct boundary.

Custom voice/reference bytes live in R2 and may be used from any device authenticated to the same account.

Because all custom voice/reference bytes use the same R2 storage policy, do not retain a one-value `REMOTE` storage-mode enum solely for these rows. Their storage implementation is defined by the voice-reference subsystem itself.

If sharing the generic `media_assets` table would force nullable `project_id` plus storage-mode polymorphism back into the model, prefer a dedicated account-level voice-reference asset model/table. The exact table split should minimize generic branching and keep project media and account voice media semantically separate.

## 7. Asset-library boundaries

Project asset-library endpoints are project-scoped and return only assets whose `project_id` matches the requested owned project.

Voice/reference library endpoints are account-scoped and independent of project asset-library endpoints.

A Desktop installation must not obtain project media from another installation simply because both projects belong to the same account.

## 8. Mapper and timeline invariants

`ProductionBeatMediaSelectionMapper` must not depend on `local_media_materializations` or a storage-mode branch. It validates direct project ownership, account ownership, READY status, deletion state, and compatible media type.

All MyBatis XML files must be parsed in a regression test so malformed XML such as an unescaped `<` operator fails CI before application startup.

Production timeline/readiness queries must use the same direct project-media ownership invariant. Backend must not report a beat/render input as ready when the selected asset belongs to a different project.

## 9. Device isolation

Device isolation is enforced primarily by the Desktop local catalog:

- Device A only lists/opens projects registered in Device A's catalog.
- Device B only lists/opens projects registered in Device B's catalog.
- Deep links or manually entered project IDs do not bypass the local-project gate.
- Resource queries for timeline, chapters, assets, characters, render, and related project data remain disabled until the local project is validated.

The backend account may still contain durable orchestration records for projects created from multiple devices. That does not make those projects discoverable on every Desktop installation.

## 10. Compatibility and migration

NarrativeX is pre-release. This is a hard cutover.

No compatibility layer is required for:

- stale cloud-synchronized local project catalog entries;
- old sync-status values;
- old remote/hybrid project-media modes;
- old `local_media_materializations` ownership inference;
- development/test project-media rows without `project_id`.

Existing development data may be deleted/reseeded when required by the schema migration.

## 11. Tests and verification

The change is complete only when tests cover these invariants:

1. local project catalog has no cloud/sync fields or reconcile API;
2. Desktop project list is sourced only from the local catalog;
3. project detail and project resource queries require local registration;
4. local project media registration sends and persists `projectId`;
5. project asset listing is scoped by `project_id`;
6. beat media selection rejects an asset owned by another project;
7. generated media materialization writes `project_id` and does not reuse media identity across projects;
8. project-media contracts contain no storage-mode enum when only one storage behavior remains;
9. custom voice/reference contracts contain no `projectId` and continue using the account/R2 flow;
10. MyBatis mapper XML is parsed during tests;
11. backend verification, Desktop checks/typecheck/tests, and relevant AI-worker tests pass.

## Non-goals

This change does not add project synchronization, project migration between devices, cloud project backup, or project-media sharing. Those are separate future product features and must introduce explicit models rather than reviving generic sync/storage-mode fields preemptively.
