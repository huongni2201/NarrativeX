# ADR-0005: Local-first project media and Desktop-only final render

- **Status:** Accepted
- **Date:** 2026-10-15 (consolidated)
- **Replaces:** former ADR-0006 (storage/render part) and the older local media, media registration, backup/segment cache, render lifecycle and watermark decisions (Git history)

## Context

Long-form story videos produce gigabytes of intermediate and final media. Moving those bytes through a server or cloud store adds cost and failure modes without helping a single-user installation (ADR-0001). Final renders also need crash recovery and must never be finalized twice.

## Decision

### Project media

1. Project bytes (generated and imported images, audio, video, PROJECT voice references, render work and cache, final MP4) live in the Desktop project workspace. `GLOBAL_LOCAL` voice references live in the local application voice library.
2. Electron main maps stable backend asset IDs to checksum-verified, project-relative files through `project.manifest.json`. PostgreSQL stores IDs, checksums, opaque project-relative keys and metadata, never absolute machine paths or media bytes.
3. Import: main performs selection, metadata inspection and hashing. The renderer receives metadata plus a short-lived, one-use selection token bound to sender window and operation. The backend registers a local-only identity, then main commits the verified bytes to the manifest. `USER_PROVIDED_AUDIO` import is explicit and never falls through to TTS.
4. Generated media is materialized through a short-lived opaque capability and validated for origin, size, type and checksum before registration.
5. Backups are versioned project-directory snapshots. Backup and restore validate manifest and project identity, and restore first saves the active workspace as a `PRE_RESTORE` snapshot. Cleanup resolves only project-scoped registry IDs and never follows symlinks.

### Final render

6. Final project rendering runs only in Electron main. The backend admits the render, freezes an immutable render snapshot (cuts, timing authority, profile, subtitles, watermark policy), reserves capacity and assigns a paired device. The device claims a lease, sends heartbeats and reports progress, then completes or fails.
7. Render journals distinguish known failure, user cancellation and interruption. Restart or lease loss resumes from the last recoverable checkpoint. A render never finalizes under a lost lease.
8. Segment-cache keys include every encoded input (renderer, profile, composition, adapter and FFmpeg versions, dimensions, frame rate, audio mode, encoder, quality, color, watermark, subtitle settings, media type and checksum, source range, framing, motion, transitions) and exclude workflow IDs and absolute timeline position. Cache bytes are disposable, and every export still concatenates, muxes, verifies and registers its own artifact.
9. Timeline duration, camera and media changes are Desktop draft overrides until export. Export sends explicit overrides, and admission freezes them.
10. The backend freezes the watermark policy in the render profile. Desktop rejects missing or unsupported policy and applies the fixed overlay. This protects supported-client behaviour; it is not cryptographic proof against a machine operator.

## Invariants

1. No server, cloud or Python-worker final render, and no remote final-video store. Introducing one requires a new ADR.
2. Provisional timing is review-only and never satisfies render admission.
3. Final artifact metadata is committed only after local validation under the active lease.

## Consequences

- Long-form media avoids cloud transfer, and the backend stays a metadata authority.
- Disk pressure, cleanup policy and device migration are Desktop responsibilities that still need hardening.

## Related

- [ADR-0004](ADR-0004-desktop-client-boundary.md) · [ADR-0008](ADR-0008-video-first-shot-production.md) · [Editing pipeline](../architecture/editing-pipeline.md)
