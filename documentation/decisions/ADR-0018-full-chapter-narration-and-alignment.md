# ADR-0018: Full-chapter narration and alignment

## Status

Accepted — 2026-08-20

## Context

NarrativeX needs narration timing before visual planning can become duration-authoritative. TTS must survive retries and Chapter edits without regenerating or silently attaching audio to the wrong source. Provider URLs are not durable media ownership boundaries.

## Decision

- A narration request snapshots `chapter_id`, `chapter_row_version`, `source_hash`, and exact source text. Editing a Chapter creates a different narration identity.
- Request identity is deterministic from the source snapshot plus voice/language/rate and segmentation version. Duplicate admission reuses the same request.
- Full-chapter narration is one logical asset. Provider calls may be segmented internally for provider limits and retry safety; segmentation is sentence/paragraph oriented, never visual-scene oriented.
- Alignment offsets use UTF-16 code-unit text positions and millisecond audio positions. Spans are ordered and must not overlap. `audioStartMs < audioEndMs`, `textStart <= textEnd`, and the final audio end must remain within 250ms of measured asset duration.
- `NarrationAsset` is immutable and references `project_assets` as the minimum MediaAsset/storage abstraction. A provider response URL is never the authoritative artifact.
- Worker TTS contracts are provider-neutral. Deterministic fake providers are the acceptance-test default. Provider-specific adapters stay under worker infrastructure.
- Ambiguous external submission follows the existing durable provider-operation rule: fence before crossing the provider boundary and never blind-resubmit an outcome that may already have been charged.

## Phase 2.5 execution-policy foundation

Fallback decisions are backend policy, not Wan-provider behavior. The backend vocabulary includes `BASIC_IMAGE_MOTION` / `IMAGE_TO_VIDEO` plus fallback reasons for provider availability/timeouts, GPU capacity, quota, cost limits and retry exhaustion. The initial policy keeps `IMAGE_MOTION` on basic motion and treats eligible hybrid scenes as I2V candidates only while the execution context authorizes them.

## Consequences

Visual planning can consume one immutable narration timeline without owning TTS semantics. Later subtitle/word-level alignment may refine the spans without changing the public span contract. Storage backends can move from local MinIO to Cloudflare R2 or another S3-compatible store without changing `NarrationAsset` identity.
