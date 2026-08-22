# ADR-0016: Verified media upload and immutable asset lifecycle

- Status: Accepted
- Date: 2026-08-21
- Scope: Account-scoped media upload, validation, persistence, and catalog boundaries.

## Decision

- Clients create an upload intent; the backend generates the storage key and presigned R2 URL.
- Browser presigned uploads require a bucket CORS policy for each allowed frontend origin,
  including `Content-Type` and `x-amz-checksum-sha256`; the local policy is documented in
  `documentation/workflows/R2_BROWSER_UPLOAD_CORS.md`.
- Finalization reads object metadata from R2 and persists a `READY` asset only after size, MIME,
  and SHA-256 match the intent. Provider MIME parameters are normalized, while checksum
  verification accepts the provider's base64 or hex representation. Missing or mismatched
  objects become `REJECTED`.
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
