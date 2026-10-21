# ADR-0010: Installation-wide Prompt Settings, frozen at admission

- **Status:** Proposed — backend persistence, API, composers and admission freezing are implemented. Desktop runtime and provider-level acceptance are pending (see the [plan](../plans/prompt-settings.md)).
- **Date:** 2026-10-14
- **Replaces:** former ADR-0035 (same decision, renumbered)

## Context

Style and creative prompt text was hard-coded: `ImageStyle` held style and negative prompts, `SharedCharacterRenderingLanguage` held the character block, character references were fixed to `CINEMATIC_ANIME`, video to `CINEMATIC`, and analysis used one packaged prompt. Users could not review or tune any of it, and per-request style fields disagreed with what callers actually used.

## Decision

1. The backend stores **one** `PromptSettings` document per installation (`prompt_settings`, a singleton row with a compare-and-set `revision`). There is no user, account or project override (ADR-0001).
2. The document contains styles (`id`, `name`, `positivePrompt`, `negativePrompt`, `characterRenderingPrompt`), the active style ID, instruction blocks for chapter analysis, character reference, storyboard and video, and a video negative prompt. Built-in defaults come from a versioned resource and seed the row on first use. Seeding never overwrites stored content.
3. **Editable versus protected:** users edit creative text only. Response schemas, identity locks, continuity and reference rules, structural sections, sanitization and safety constraints stay backend-owned. Custom text is appended to those parts and never replaces them.
4. Validation is strict: unknown fields are rejected, IDs must match a pattern, UTF-8 byte limits apply per block and in total, at most 32 styles are allowed, NUL is rejected and CRLF is normalized. `revision` travels as a decimal string.
5. API: `GET/PUT /api/v1/settings/prompts` (a stale revision returns 409) and `POST /api/v1/settings/prompts/preview` (read-only, no provider call, no job).
6. **Resolve once, freeze at admission:** each new operation resolves settings exactly once, after idempotent replay is answered. It freezes the compiled prompts plus provenance (`revision`, `styleId`, `effectiveHash`) into its own snapshot: media plans, shot-take snapshots, batch shot items and chapter-analysis prompt snapshots. Chapter Analysis contract 1.3 composes the same saved instruction under each protected CANON/STORY prompt and freezes both prompt/schema pairs and the final result schema in the execution snapshot. Queued, retried and replayed work keeps its frozen prompts.
7. Request fingerprints exclude style and compiled prompts, so saving new settings never turns a replay into a conflict. Operations admitted by older builds replay through a fingerprint reconstructed from their stored prompts. A caller may send the previewed revision, and a mismatch at admission is a conflict. The deprecated `imageStyle` request field is accepted and ignored.

## Consequences

- A change affects only operations admitted afterwards.
- Custom analysis instructions add input bytes and count against the analysis byte budget.
- A custom style cannot weaken backend protections, but it can still lower output quality.
- The tables are folded into the V4 baseline (ADR-0002 policy). This does not migrate an installed database.

## Acceptance before "Accepted"

PostgreSQL/Testcontainers coverage, the real Electron Settings → Prompt flow, and the known residuals listed in [current status](../current-status.md) must be verified.

## Related

- [Plan](../plans/prompt-settings.md) · [ADR-0001](ADR-0001-single-user-local-first.md) · [ADR-0003](ADR-0003-durable-compute-execution.md) · [ADR-0009](ADR-0009-chapter-analysis-agy-cli.md)
