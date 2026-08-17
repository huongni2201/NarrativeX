# Shorts / Reels Generation Workflow

Shorts are independent vertical artifacts derived from approved long-form timeline/assets. They are not fixed-interval crops and do not require rerendering the complete long-form project.

## Flow

```text
Approved long-form timeline / chapter
  -> authentication/ownership + abuse gate
  -> SHORT_HIGHLIGHT_ANALYZE (Vertex AI Gemini)
  -> ranked ShortCandidate (hook/conflict/reveal/emotion/payoff)
  -> user selects or edits range/title
  -> duration policy (30s hard min; 45–60s default; 60–90s when needed)
  -> 9:16 Short visual plan
  -> reuse approved assets / crop-reframe / basic motion / new image plan
  -> OperationPlan + estimate + reservation + entitlement check
  -> subtitles + audio mix
  -> SHORT_RENDER with vertical RenderProfile
  -> validate FinalArtifact and export
  -> notification/outbox
```

## Planning rules

The highlight analyzer ranks a coherent story beat, not a fixed time interval. The vertical planner prefers approved assets when crop/reframe preserves identity and composition. It generates only the missing or unusable visuals. Visual density is higher than long-form but adaptive: approximately 6 visuals/30s, 8–10/45s and 10–12/60s are priors, not hard cost formulas.

The `ShortClip` stores source range, candidate, 9:16 render profile, selected visual items, crop strategy and version. Editing a short creates a delta `OperationPlan`; source long-form assets remain immutable.

## Durable execution

`SHORT_HIGHLIGHT_ANALYZE`, `SHORT_VISUAL_PLAN` and `SHORT_RENDER` are persisted jobs/stages with leases, idempotency keys and billed-user attribution. Any new image or selected motion stage uses the same reservation-before-submit rule and provider-operation reconciliation as long-form generation. Redis only accelerates delivery/progress; PostgreSQL remains authoritative.

```text
ShortClip: DRAFT -> PLANNING -> READY -> RENDERING -> REVIEW
           -> APPROVED / FAILED / OUTDATED
FinalArtifact: PENDING -> VALIDATING -> READY / INVALID
```

## Entitlement, safety and completion

Server-side `PlanEntitlement` and `UsageWindow` enforce Short export/month, watermark, max quality, concurrent expensive jobs and credits atomically. Account/IP abuse limiting runs before cost reservation. Story/reference/prompt input and generated output pass the moderation and prompt-injection gates; real-person references require consent. A `REVIEW`/`BLOCK` result prevents publishing.

The renderer uses a deterministic 9:16 profile with safe dimensions, normalized media/audio and atomic temporary-output promotion. A Short export is complete only when `FinalArtifact` metadata, file, checksum, MIME, dimensions, duration and manifest validate. Terminal state and cost reconciliation are committed with an outbox event for in-app and optional email notification. PostgreSQL and critical exported media follow the documented backup/DR policy.
