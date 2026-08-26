# ADR-0003: Media storage, generation pipelines and external provider integrations

- **Status:** Accepted; amended 2026-08-26 for Desktop local-only final rendering
- **Date:** 2026-08-20 (consolidated 2026-08-22; amended 2026-08-26)
- **Scope:** Remote generated-media transport, narration pipelines, provider integrations and media materialization.
- **Desktop boundary:** [ADR-0012](./ADR-0012-desktop-local-first-media-and-render-execution.md)

## Context

NarrativeX produces generated images, character references, narration, uploaded audio, alignment data, render intermediates and final video. Provider/worker execution sometimes requires durable remote bytes because worker container disks are ephemeral, while the product editor and final renderer are now Desktop-local.

The previous architecture also retained a remote final-video storage/render path. That path has been removed. This ADR now covers only remote generated-media transport and provider execution; it does not define final-video storage.

## Decision

### 1. Remote generated-media transport

```text
Cloudflare R2
  -> generated image bytes
  -> generated narration bytes
  -> provider/worker media that needs remote durability before materialization

PostgreSQL
  -> authoritative metadata, ownership, lineage, checksums,
     provider identity and execution state

Worker filesystem
  -> ephemeral scratch only

Electron project workspace
  -> accepted/project media after Desktop materialization
  -> render work/cache
  -> final MP4
```

R2 is a provider/worker transport and durability boundary, not the source of truth for final Desktop project storage.

### 2. Desktop materialization

Accepted generated media required by the editor/final render is materialized into `ProjectStorage` and registered in `project.manifest.json` using stable asset IDs, project-relative paths, size and SHA-256.

Absolute machine paths never become backend identities.

### 3. Server-owned visual style profiles

Media generation accepts an allow-listed visual style code and resolves it on the backend to a versioned prompt policy. The resolved style is snapshotted with the authorized generation request; clients do not become the source of truth for provider policy.

### 4. Upload and validation

Remote upload/provider flows use backend-authorized intents/state and validate expected size/type/checksum before READY. Worker validation runs under durable leases and isolated scratch workspaces.

Desktop-native imports do not need remote upload merely to become usable project media. Electron main performs inspect/hash, backend stable identity registration and local workspace commit.

### 5. Narration and multi-part audio

Narration remains timing authority.

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

Generated narration may use VieNeu/provider execution and R2 transport before Desktop materialization. Multi-part uploaded audio is modeled as ordered parts on one logical timeline; file boundaries are not Chapter boundaries.

### 6. Vertex image execution

Authorized image generation uses the configured Vertex provider path with durable provider-operation state and reconciliation. Provider output may be staged remotely, then materialized into the Desktop workspace for project use.

### 7. Final video boundary

Final project rendering belongs to Electron main under backend assignment/lease control.

```text
materialized local project media
  -> Electron FFmpeg/ffprobe
  -> local project artifacts/<jobId>/final.mp4
  -> backend FinalArtifact metadata only
```

The backend and Python workers do not store, proxy, preview-stream or upload final MP4 bytes. Publishing/uploading is a separate explicit workflow from an exported local artifact.

### 8. Notifications and progress

PostgreSQL remains authoritative for generation/job state. SSE/polling may deliver progress to clients but is not a durable event store. Desktop local execution reports progress/lease state to the same backend authority.

## Invariants

1. PostgreSQL is the authoritative record of ownership, plans, job state and media identity metadata.
2. Worker scratch disks are ephemeral.
3. R2 is limited to generated/provider media transport and durability before local materialization.
4. Final MP4 bytes are Desktop-local only.
5. Narration timing drives visual timing; arbitrary fixed image durations are not authoritative.
6. Ambiguous paid-provider outcomes remain `UNKNOWN` until reconciliation.
7. Provider/R2 credentials never enter renderer code.
8. Local absolute paths are never persisted to backend state.
9. Final playback/export reads the local artifact directly.

## Consequences

There is one final-render/storage model: Desktop local-first. Remote storage remains only where provider/worker media transport genuinely requires it. This removes duplicate render executors, duplicate final-video storage adapters and backend byte-proxy responsibilities.

## Related decisions

- [ADR-0001: System topology, execution and persistence](./ADR-0001-system-topology-execution-and-persistence.md)
- [ADR-0010: Electron desktop editor client boundary](./ADR-0010-desktop-editor-client-boundary.md)
- [ADR-0011: Google OAuth-only desktop authentication](./ADR-0011-google-oauth-only-desktop-auth.md)
- [ADR-0012: Desktop local-first project media and render execution](./ADR-0012-desktop-local-first-media-and-render-execution.md)
