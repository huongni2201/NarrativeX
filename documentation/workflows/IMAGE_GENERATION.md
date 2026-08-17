# Image Generation Workflow

Image generation is image-first and visual-beat/shot scoped. It produces `KeyframeAsset`/approved image assets; AI video is a separate selected-beat workflow.

## Preconditions and planning

```text
Authenticated owner
  -> story/reference rights + consent checks
  -> input moderation and prompt-injection boundary
  -> CharacterVersion/Outfit/Location/Style snapshot resolution
  -> ImageGenerationSettings (aspect ratio + quality tier + overrides)
  -> capability validation
  -> AffectedScope + asset reuse/reframe resolution
  -> OperationPlan estimate and user confirmation
  -> CostReservation
```

The planner prices only `NEW_IMAGE`/`REGENERATE` work. Approved reusable assets and compatible reframe/basic-motion work reduce the plan. Quality tiers are provider-agnostic (`DRAFT`, `STANDARD`, `HIGH`) and must not be confused with final video resolution.

## Durable execution

1. The API accepts an idempotency key for a single beat/shot or batch request. It creates a `GenerationJob` linked to an `OperationPlan` and persists required `StageAttempt` rows.
2. The worker claims `SHOT_IMAGE_GENERATE`/visual-beat stages with a lease and checks resource class, fairness, provider circuit, entitlement and remaining reservation.
3. The resolved prompt is a snapshot containing story/visual intent, CharacterVersion, OutfitVersion, reference manifest, style/location, negative constraints, workflow/model version and requested ratio/quality. Story text remains untrusted data.
4. Before provider submission, persist `ProviderOperation(RESERVED)` with provider, capability, request fingerprint and reservation context. The provider adapter performs `estimate/submit/status/reconcile/fetch` without vendor branches in the domain.
5. Known transient failures retry with capped exponential backoff/jitter. Ambiguous timeout becomes `UNKNOWN`; reconcile provider status/storage evidence before any resubmit.
6. Write output to a unique temporary object, validate MIME, checksum, positive dimensions, requested ratio/crop strategy and provider response schema, then immutably promote it to an `Asset`.
7. Run `IdentityCheck` against the reference snapshot. `PASS` can proceed to review; `LOW_SCORE`/`FAILED` remains review/retry, never silent auto-approval. Output moderation maps to `SAFE`/`REVIEW`/`BLOCK`.
8. User batch-approves/rejects/regenerates. Approval is an immutable selection; regeneration creates another attempt and preserves prior attempts for audit.
9. Meter provider/internal cost, storage bytes and usage. Consume/release reservation and append `UsageLedger`/`ResourceUsageRecord` entries with `billed_to_user_id`.
10. Commit stage/job state and transactional notification outbox. Parent progress is persisted; SSE is only an acceleration channel.

## States

```text
VisualBeat: PROPOSED -> READY_FOR_VISUAL -> GENERATING -> REVIEW
            -> APPROVED / REJECTED / OUTDATED
StageAttempt: QUEUED -> RUNNING -> COMPLETED / FAILED
              -> STALLED -> RETRY_WAIT / RECONCILING
ProviderOperation: RESERVED -> SUBMITTED -> RUNNING
                  -> COMPLETED / FAILED / UNKNOWN
```

## Safety and entitlement gates

Hard-block moderation categories stop before provider submission. `REVIEW` holds the asset and prevents publish unless an authorized review policy resolves it. Server-side entitlement enforces image capability, concurrent expensive jobs and credits; client-side flags cannot bypass it. Real-person references require consent and tenant-isolated identity lifecycle.
