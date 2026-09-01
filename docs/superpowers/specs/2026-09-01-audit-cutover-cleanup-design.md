# Audit Cutover Cleanup Design

**Status:** Approved for implementation

## Goal

Finish the repository cleanup identified by the 2026-09-01 audit without restoring removed legacy behavior. The target end state is a green CI head, a fully local project-media/render contract, and renderer feature screens that compose semantic hooks instead of owning backend/native workflows.

## Scope

1. Repair stale CI expectations after the local-final-artifact cutover.
2. Remove remaining Desktop `storageMode` residue and stale `GENERATE` test vocabulary.
3. Remove unused `MediaBeatPlan` compatibility construction paths that exist only for old callers/tests.
4. Move Assets native/backend/cache sequencing behind feature query/mutation hooks.
5. Move Characters generation/native/cache sequencing behind feature query/mutation hooks while preserving the existing serial Gemini queue semantics.
6. Move narration cache invalidation out of `ChaptersScreen` and into the owning mutation hook.
7. Keep Electron `sandbox: false` as an explicit compatibility exception for now; add no forced sandbox cutover without a runtime-capable verification environment.
8. Preserve intentional timing compatibility seams (`source_anchor` nullable parsing and complete persisted audio timing consumption) because current ADRs explicitly retain them.

## Non-goals

- Do not reintroduce backend final-artifact content/download endpoints.
- Do not reintroduce project-media R2 fallback, dual-write, or storage-mode branching.
- Do not change user-visible layouts or Gemini queue behavior.
- Do not remove intentional timing compatibility contracts in this cleanup.
- Do not change database schema unless an implementation check proves it is required.

## Architecture

### Final artifact ownership

Desktop owns final rendered video bytes. Backend final-artifact responses expose metadata only, so `previewAvailable` and `downloadAvailable` remain false with null URLs. Tests must follow this contract.

### Project media ownership

All project media used by Desktop render is device-local. `storageMode` is not part of the Desktop project-media/render contract. Local availability is determined by the local asset store/preflight rather than REMOTE/LOCAL_ONLY/HYBRID branching.

### Renderer feature boundaries

Feature screens may own ephemeral UI state and compose semantic hooks. Backend transport, preload/native capabilities, cache invalidation, and multi-step persistence/provider workflows live in feature `queries/` or focused service/model modules.

Assets target flow:

```text
AssetsScreen
  -> useProjectAssetLocalStates
  -> useImportProjectAsset / useRepairProjectAsset
  -> assets API + typed localStorage bridge + cache invalidation
```

Characters target flow:

```text
CharactersScreen
  -> character selection/presentation
  -> useCharacterGenerationActions
  -> characters API + character reference generation + cache invalidation

CharactersScreen
  -> queue presentation and start/stop/skip callbacks
  -> useCharacterGeminiQueueRunner
  -> pure queue model + persistence adapter + generation action
```

### Domain cleanup

`MediaBeatPlan` should expose only construction paths used by current production code. Tests should use explicit full construction or test fixtures/builders instead of keeping legacy domain overloads alive.

## Error handling

Existing user-visible notices and queue pause/skip semantics remain unchanged. Native selection cancellation remains a no-op. Import/repair/generation failures surface through existing screen notices while hooks throw typed/normal `Error` values.

## Verification

- Backend: targeted storyboard/final-artifact integration tests, then `mvn verify`.
- AI worker: contract-boundary test, Ruff, mypy, full worker tests.
- Desktop: feature-boundary tests plus `npm test`, `npm run type-check`, `npm run build`.
- Repository gates/documentation drift.
- GitHub Actions on the exact final head.

Electron sandbox enablement is intentionally deferred until runtime smoke verification is available; this cleanup must not claim that compatibility exception is removed.
