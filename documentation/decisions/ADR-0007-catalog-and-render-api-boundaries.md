# ADR-0007: Catalog and render API boundaries

## Status

Accepted

## Context

The frontend has catalog and render surfaces, while the backend schema already owns generation jobs,
render manifests, final artifacts, and account-scoped media metadata. Static frontend catalogs and
client-controlled identity would make those surfaces diverge from PostgreSQL state.

## Decision

- Persist style presets and enabled voices in PostgreSQL and expose read-only catalog endpoints under
  `/api/v1/style-presets` and `/api/v1/voices`.
- Expose account-scoped media metadata under `/api/v1/assets`; metadata registration starts at
  `PENDING_UPLOAD`, approval is allowed only after storage validation marks the row `UPLOADED` or
  `VALIDATING`, and referenced narration media cannot be deleted.
- Queue chapter render requests only after the authoritative workspace projection reports completed
  analysis, completed visuals, and ready audio. Render admission creates the job, operation plan,
  quota reservation, stage attempt, and outbox event in one transaction.
- Return final-artifact metadata from `/api/v1/artifacts`. Download signing remains an infrastructure
  boundary and the API must return an explicit unavailable state until a durable storage adapter is
  configured; it must not manufacture public URLs from `storage_key`.

## Consequences

The frontend no longer needs to treat presets or voices as business-data mocks. Binary upload,
provider image materialization, and signed object delivery remain separate work because this repository
does not yet contain an R2/storage adapter.
