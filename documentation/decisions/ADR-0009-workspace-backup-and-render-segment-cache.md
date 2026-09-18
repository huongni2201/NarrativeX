# ADR-0014: Workspace backup and deterministic render segment cache

## Status

Accepted

## Context

Desktop workspaces contain the manifest, imported/generated local bytes, render artifacts, and crash-recovery journals. Users need a recoverable backup boundary, while repeated exports should not re-render unchanged visual beats.

## Decision

- A backup is a versioned `.narrativex` directory snapshot containing the project manifest, assets, artifacts, work journals, and cache.
- Backup creation requires a destination outside the active project directory and validates the source manifest before copying.
- Restore validates schema and project identity before staging. If an active project exists, it is renamed to `.before-restore-*`; no irreversible deletion is performed by restore.
- Archive copies and validates the destination while leaving the active workspace untouched. True workspace relocation remains a separate configuration change because `ProjectStorage` keeps an active root.
- Electron main owns a registry at the projects root for retained snapshots. Each record contains an opaque snapshot ID, project ID, type (`BACKUP` or `PRE_RESTORE`), native path, creation time, size, and cleanup policy. Native paths never cross the preload boundary.
- Desktop storage usage reports include assets, artifacts, temporary render work, derived segment cache, and only registry-owned retained snapshots. Unmanaged sibling directories are neither counted nor deleted.
- Snapshot accounting rejects symlink roots/manifests and does not follow symlink entries while calculating bytes. Cleanup resolves a snapshot by project-scoped registry ID, validates its ownership boundary, deletes it, and removes the registry record.
- Segment cache entries are keyed by renderer version, output dimensions/fps, visual beat identity, asset identity/checksum, duration, and camera movement. A cache hit only supplies the segment bytes; the current job still performs concat, audio concat, mux, verification, and artifact registration.
- Cache entries are disposable derived data and never replace PostgreSQL asset identity or the project manifest.

## Consequences

- Backups are portable directories and can be copied to another disk without exposing absolute paths in backend state.
- Restore may temporarily consume extra disk space because the previous project is preserved for recovery.
- Restore registers the preserved active workspace as a `PRE_RESTORE` snapshot before replacing the active directory; explicit snapshot cleanup is required to reclaim those bytes.
- A changed source checksum or render setting naturally invalidates the corresponding segment cache entry.
- Single-file archive packaging, workspace-root relocation, installer signing, and auto-update remain later packaging work.
