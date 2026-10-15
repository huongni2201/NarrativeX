# ADR-0035: Installation-wide Prompt Settings

## Status

Proposed — 2026-10-14. Backend persistence, API, composers and admission freezing are implemented
in the working tree; Desktop runtime verification and provider-level acceptance are tracked in
[the implementation plan](../product/PROMPT_SETTINGS_IMPLEMENTATION_PLAN.md) and are not claimed here.

## Context

Image-style and creative prompt text was fixed in code: the `ImageStyle` enum owned style and
negative prompts, `SharedCharacterRenderingLanguage` owned the character rendering block, character
reference prompts were hard-wired to `CINEMATIC_ANIME`, video prompts were hard-wired to
`CINEMATIC`, and Chapter Analysis used one packaged prompt. Users could not review or tune these
prompts, and per-request style fields disagreed with what callers actually used.

NarrativeX is single-user and local-first (ADR-0020): there is one installation, not accounts or
per-project owners.

## Decision

- The backend stores **one** `PromptSettings` document per installation in PostgreSQL
  (`prompt_settings`, singleton row with a compare-and-set `revision`). There is no user, account
  or project override.
- The document holds styles (`id`, `name`, `positivePrompt`, `negativePrompt`,
  `characterRenderingPrompt`), the active style id, instruction blocks for chapter analysis,
  character reference, storyboard and video, and a video negative prompt. Built-in defaults live in
  a versioned resource and seed the row on first use; seeding never overwrites stored content.
- **Editable versus protected.** Users edit creative text only. The backend still owns the response
  schema, identity locks, continuity and reference rules, structural prompt sections, sanitization
  and safety constraints; custom instructions are appended to, never substituted for, those parts.
- Strict validation (unknown fields rejected, id pattern, UTF-8 byte limits per block and in total,
  at most 32 styles, NUL rejected, CRLF normalized). The revision travels as a decimal string so a
  BIGINT never loses precision in JSON clients.
- API: `GET/PUT /api/v1/settings/prompts` (PUT carries the revision being edited; stale → 409) and
  `POST /api/v1/settings/prompts/preview` (draft or saved settings against a real character,
  visual beat or shot; read-only, no provider call, no job).
- **Resolve once, freeze at admission.** Each new operation resolves the current settings exactly
  once, after idempotent replay has been answered, and freezes the compiled prompts plus
  provenance (`revision`, `styleId`, `effectiveHash`) into its own snapshot: media plans
  (`renderSettingsJson`), shot-take snapshots (`context.promptSettings`), batch shot items
  (`frozen_input_json`) and Chapter Analysis (`chapter_analysis_prompt_snapshots`, and the local
  execution snapshot's prompt template). Queued, retried and replayed work keeps its frozen
  prompts; new operations in every project use the current configuration.
- **Settings-independent request identity.** Request fingerprints no longer include style or compiled
  prompts, so a later Save cannot turn a replay into a conflict. Operations admitted by older builds
  replay through a legacy fingerprint reconstructed from their stored prompts. A caller that
  previewed may send the previewed revision; a mismatch at admission is a conflict instead of a
  silently different prompt.
- The deprecated `imageStyle` request field is accepted and ignored.

## Consequences

- Changing the style affects only operations created afterwards. Mixed-style chapters are possible
  after a selective regeneration; the preview shows which revision/style an operation will freeze.
- Chapter Analysis custom instructions add input bytes/tokens; local admission counts them against
  the configured byte budget and the Vertex preflight counts them against the token budget.
- A custom style cannot weaken backend-owned protections, but it can still steer output quality;
  correctness of creative text is the user's responsibility.
- V14 adds `prompt_settings` and `chapter_analysis_prompt_snapshots`; no existing table is changed.
- Existing PostgreSQL/Testcontainers coverage, Desktop runtime flows and provider output quality
  must be verified separately before this ADR is accepted.

## References

- [Implementation plan](../product/PROMPT_SETTINGS_IMPLEMENTATION_PLAN.md)
- [ADR-0020](ADR-0020-single-user-local-first-architecture.md)
- [ADR-0021](ADR-0021-submission-checkpoint-and-worker-recovery-semantics.md)
- [ADR-0034](ADR-0034-local-antigravity-cli-chapter-analysis.md)
