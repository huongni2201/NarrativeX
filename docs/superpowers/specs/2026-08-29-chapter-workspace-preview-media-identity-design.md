# Chapter Workspace Preview Media Identity Design

## Context

The local-first media cleanup removed `visual_beats.preview_asset_id` and made `visual_beats.preview_media_asset_id` the canonical generated/default image identity for a Visual Beat. `ChapterWorkspaceMapper.previewScenes()` was missed by that cleanup and still joined `project_assets` through the removed legacy column, causing PostgreSQL runtime failures.

The first compatibility fix removed the stale join but kept `previewImageUrl` nullable. That avoids the SQL error but leaves an obsolete backend-to-desktop contract that no longer matches the local-first architecture.

## Decision

Chapter Workspace preview scenes expose a stable media identity only:

```text
visual_beats.preview_media_asset_id
  -> ChapterWorkspacePreviewRow.previewMediaAssetId
  -> ChapterWorkspaceAccess.PreviewScene.previewMediaAssetId
  -> ChapterWorkspaceResponse.PreviewScene.previewMediaAssetId
  -> @narrativex/client-contracts ChapterWorkspacePreviewScene.previewMediaAssetId
  -> Desktop chapter workspace parser
```

`previewImageUrl` is removed from this flow.

The backend must not resolve local filesystem paths or invent HTTP URLs for project-local images. Desktop remains responsible for converting a MediaAsset identity into a renderable preview URL when a UI surface needs one.

## Query Semantics

`ChapterWorkspaceMapper.previewScenes()` selects the first non-null preview media identity in deterministic Visual Beat order for each Scene:

```sql
(
  array_agg(vb.preview_media_asset_id ORDER BY vb.order_index, vb.id)
  FILTER (WHERE vb.preview_media_asset_id IS NOT NULL)
)[1] AS preview_media_asset_id
```

The query does not join `project_assets` and does not require a remote URL. Scenes without attached preview media return `NULL`.

## Backend Model Changes

Replace `String previewImageUrl` with `UUID previewMediaAssetId` in:

- `ChapterWorkspacePreviewRow`
- `ChapterWorkspaceAccess.PreviewScene`
- `ChapterWorkspaceResponse.PreviewScene`
- `MyBatisChapterWorkspaceQueryAdapter`
- `GetChapterWorkspaceUseCase`

The mapper result map changes from `preview_image_url` to `preview_media_asset_id`.

## Client Contract Changes

Replace:

```ts
previewImageUrl: string | null;
```

with:

```ts
previewMediaAssetId: string | null;
```

in `packages/client-contracts/src/chapter.ts`.

Update the Desktop runtime parser in `chapter-workspace-contract.ts` to validate `previewMediaAssetId` as a nullable string and stop accepting `previewImageUrl`.

No Chapter Workspace React component currently consumes `previewImageUrl`, so this contract cleanup does not require a UI layout change.

## Desktop Preview Resolution Boundary

If Chapter Workspace later renders scene thumbnails, it should reuse the existing Storyboard preview path rather than duplicate storage logic:

```text
previewMediaAssetId
  -> assetsApi.get(assetId)
  -> storageMode/origin
  -> resolveStoryboardImagePreview(...)
  -> LOCAL_ONLY => localAssetPreviewUrl(projectId, assetId)
  -> remote-backed => short-lived backend download URL
```

Absolute filesystem paths remain outside backend contracts.

## Tests

### PostgreSQL integration

A workspace integration test must seed a Visual Beat with `preview_media_asset_id`, call `/workspace`, and assert:

- HTTP 200
- `previewScenes[0].previewMediaAssetId` equals the seeded MediaAsset ID
- `previewImageUrl` is absent

This reproduces the production schema path that previously failed on `preview_asset_id`.

### Mapper/use-case unit tests

Update existing Chapter Workspace adapter/use-case tests to construct and assert `previewMediaAssetId` instead of `previewImageUrl`.

### Desktop contract tests

Update contract/parser tests so valid Workspace payloads contain `previewMediaAssetId` and payloads relying on the removed `previewImageUrl` shape are rejected where applicable.

## Non-Goals

- Reintroducing `visual_beats.preview_asset_id`
- Restoring `project_assets.url` as preview identity
- Adding local filesystem paths to backend responses
- Adding a new Chapter Workspace thumbnail UI in this change
- Duplicating Storyboard media preview resolution logic

## Migration / Compatibility

NarrativeX is not deployed with a compatibility requirement for the legacy `previewImageUrl` Workspace field. The contract can be changed directly to `previewMediaAssetId` without a dual-field transition period.

The existing Storyboard API already exposes `previewMediaAssetId`, so this aligns Chapter Workspace with the established canonical identity.
