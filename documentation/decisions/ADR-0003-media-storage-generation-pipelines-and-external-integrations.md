# ADR-0003: Media storage, generation pipelines and external provider integrations

- **Status:** Accepted for cloud/worker execution; Desktop project-media/final-artifact storage is superseded by ADR-0012
- **Date:** 2026-08-20 (consolidated 2026-08-22; Desktop scope clarified 2026-08-24)
- **Scope:** Cloudflare R2/Google Drive cloud execution, narration pipelines, provider integrations and media delivery.
- **Desktop override:** [ADR-0012](./ADR-0012-desktop-local-first-media-and-render-execution.md)

## Context

NarrativeX produces generated images, character references, narration, uploaded audio, alignment data, render intermediates and final video. The original browser/cloud runtime required durable remote storage because worker container disks are ephemeral.

NarrativeX is now migrating its primary creator workflow to Electron Desktop. The cloud storage design remains valid for retained worker/cloud execution, but it is no longer the global storage contract for Desktop projects.

## Decision

### 1. Cloud/worker execution storage

For server/cloud execution:

```text
Cloudflare R2
  -> source/generated/reusable pipeline media
  -> generated images
  -> narration audio
  -> uploaded media accepted into the cloud pipeline
  -> character/reference media

Google Drive
  -> completed cloud-rendered final MP4 exports

PostgreSQL
  -> authoritative metadata, ownership, lineage, checksums,
     provider identity and execution state

Worker filesystem
  -> ephemeral scratch only
```

R2 buckets and Drive files remain private. Clients access them through authenticated backend endpoints, provider-neutral content boundaries or short-lived storage mechanisms where appropriate.

### 1.1 Desktop override

For the primary Electron Desktop workflow, ADR-0012 overrides the R2/Drive byte-placement rules above:

```text
Desktop project images/audio/video  -> local project workspace
Desktop render intermediates        -> local project workspace/work
Desktop final MP4                    -> local project workspace/artifacts
Backend durable business/job state  -> PostgreSQL
```

Desktop backend contracts use stable asset IDs/checksums and opaque project-relative artifact keys. They never persist absolute machine paths.

R2 may still be used for deliberately shared reusable assets such as voice/sample media that must be available across installations. The retained cloud render path may still use R2 + Google Drive as a migration fallback.

### 2. Server-owned visual style profiles

Media generation accepts an allow-listed visual style code and resolves it on the backend to a versioned prompt policy. The resolved style is snapshotted with the authorized generation request; clients do not become the source of truth for provider policy.

### 3. Cloud upload and validation

Cloud/client upload flows use backend-created upload intents and validation state. Accepted remote media is verified for expected size/type/checksum before it becomes READY. Worker validation runs under durable leases and isolated scratch workspaces.

This cloud upload lifecycle must not be reused as a requirement for Desktop-local project files. Desktop imports are registered through Electron main and the local manifest, with workspace-boundary and checksum validation as defined by ADR-0012.

### 4. Narration and multi-part audio

Narration remains timing authority.

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

Generated cloud narration may use Google TTS or VieNeu through the worker/provider boundary. Multi-part uploaded audio is modeled as ordered parts on one logical timeline; file boundaries are not Chapter boundaries.

For Desktop migration, generated/imported project narration is expected to register into the local project manifest so local rendering does not require R2 downloads. Until all generation/import paths are migrated, cloud-backed assets remain a compatibility path rather than the Desktop target.

### 5. Vertex image execution

Authorized image generation uses the configured Vertex provider path with durable provider-operation state and reconciliation. Cloud execution may stage/reconcile provider output remotely before producing a canonical media record.

For the Desktop target, successful image results must eventually be materialized/registered into the local project workspace and referenced by stable asset identity. Provider execution policy remains backend-authorized regardless of where final project bytes live.

### 6. Cloud final-video preview/download

Google Drive private files produced by the retained cloud render path are exposed only through backend-authorized provider-neutral content access. Drive credentials stay server-side and the backend streams content rather than loading full videos into memory.

This section does not apply to a `LOCAL_DESKTOP` artifact already present in the Desktop project workspace; local reveal/open/export uses native Desktop capabilities.

### 7. Notifications and progress

PostgreSQL remains authoritative for generation/job state. SSE/polling may deliver progress to clients but is not a durable event store. Desktop local execution reports progress/lease state to the same backend authority.

## Invariants

1. PostgreSQL is the authoritative record of ownership, plans, job state and media identity metadata.
2. Cloud worker scratch disks are ephemeral.
3. Cloud final MP4 exports are not duplicated into R2 by default.
4. Narration timing drives visual timing; arbitrary fixed image durations are not authoritative.
5. Ambiguous paid-provider outcomes remain `UNKNOWN` until reconciliation.
6. Credentials for R2, Drive and providers never enter renderer/browser application code.
7. For Desktop, local absolute paths are never persisted to backend state.
8. For Desktop, local project bytes and final artifacts follow ADR-0012 even when cloud fallback remains available.

## Consequences

NarrativeX temporarily supports two execution/storage modes:

- **Desktop local-first:** local project bytes + local FFmpeg artifact, backend-owned metadata/jobs.
- **Cloud/legacy:** R2 pipeline media + Google Drive final MP4, worker-owned execution mechanics.

This duplication is intentional during migration. New Desktop architecture must not be forced through cloud storage solely because the legacy web/worker path still exists.

## Related decisions

- [ADR-0001: System topology, execution and persistence](./ADR-0001-system-topology-execution-and-persistence.md)
- [ADR-0010: Electron desktop editor client boundary](./ADR-0010-desktop-editor-client-boundary.md)
- [ADR-0011: Google OAuth-only desktop authentication](./ADR-0011-google-oauth-only-desktop-auth.md)
- [ADR-0012: Desktop local-first project media and render execution](./ADR-0012-desktop-local-first-media-and-render-execution.md)
