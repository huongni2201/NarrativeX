# ADR-0016: Verified media upload and immutable asset lifecycle

- Status: Accepted
- Date: 2026-08-21
- Scope: Account-scoped media upload, validation, persistence, and catalog boundaries.

## Decision

- Clients create an upload intent; the backend generates the storage key and presigned R2 URL.
- Finalization reads object metadata from R2 and persists a `READY` asset only after size, MIME,
  and SHA-256 match the intent. Missing or mismatched objects become `REJECTED`.
- Media upload sessions are durable PostgreSQL rows. `Idempotency-Key` retries reuse the same
  session when the request is equivalent.
- MediaAsset lifecycle changes are guarded by an explicit transition service. Deletion is a
  `DELETED` status plus `deleted_at`; visible queries exclude deleted rows.
- Asset persistence uses dedicated MyBatis rows/mappers, cursor pagination, and a partial unique
  checksum index for verified, non-deleted assets.
- Public style preset responses contain display fields only. Prompt and generation configuration
  remain internal application data.

## Consequences

The backend is authoritative for object identity and metadata, while R2 remains the durable byte
store. Retries and concurrent finalization are safe to reconcile, and clients no longer control
authoritative storage metadata. Existing consumers must read asset list results from `items` with
`nextCursor`.
