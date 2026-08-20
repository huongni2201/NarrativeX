# NarrativeX Data Flow and Durability Model

PostgreSQL state, not Redis messages or process memory, determines what NarrativeX believes happened.

## Authority matrix

| Concern | Authority | Notes |
|---|---|---|
| Users/project/story/chapter/storyboard | PostgreSQL | ownership and optimistic concurrency apply |
| GenerationJob/StageAttempt | PostgreSQL | Redis may carry delivery/progress hints only |
| ProviderOperation | PostgreSQL | provider API is external evidence used for reconciliation |
| Chapter continuity identities/relations | PostgreSQL | AI keys resolve to durable project Character/Location identities |
| Usage/admission | PostgreSQL | current reservation foundation; complete billing reconciliation remains partial |
| Browser session | Redis via Spring Session | session loss may sign users out; business state remains PostgreSQL |
| Durable binary media | Cloudflare R2 | generated/reference images, narration, subtitles/manifests, scene/motion video, final exports and thumbnails; DB owns metadata/contracts |
| Worker-local media workspace | Local filesystem | ephemeral scratch/cache/FFmpeg workspace only; never an authoritative asset location |

## Trigger boundary

```text
Create Project -> metadata only
Save Chapter   -> persisted source only
Analyze        -> explicit durable AI operation
```

The backend reloads the persisted Chapter. Unsaved browser text is never the authority for the AI request.

## Implemented Chapter Analyze flow

```text
POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs
  -> authentication + ownership
  -> Project/Chapter/StoryVersion consistency
  -> persisted Chapter snapshot
  -> idempotency
  -> safety / entitlement / quota / estimated-cost admission
  -> atomic usage reservation
  -> transaction:
       OperationPlan
       GenerationJob
       StageAttempt
       OutboxEvent
  -> COMMIT
  -> optional Redis hint
  -> worker PostgreSQL claim
  -> lease + heartbeat
  -> durable ProviderOperation RESERVED
  -> provider submit/result/reconcile
  -> structured schema validation
  -> Chapter rowVersion/sourceHash re-check
  -> transactionally materialize:
       Character / ProjectCharacter / CharacterVersion
       Character AI identity mappings
       Project Location + Location AI identity mappings
       Scene / VisualBeat
       Scene -> ProjectCharacter
       Scene -> Location
       terminal StageAttempt / GenerationJob
```

## Provider lifecycle

```text
RESERVED -> UNKNOWN -> SUBMITTED -> RUNNING -> COMPLETED
                    \-> RUNNING | COMPLETED | FAILED
SUBMITTED -> UNKNOWN | COMPLETED | FAILED
RUNNING -> UNKNOWN | COMPLETED | FAILED
COMPLETED | FAILED -> terminal
```

Current worker recovery tests prove that persisted `RESERVED`/`SUBMITTED` work is reconciled after restart without blind resubmission, timeouts become `UNKNOWN`, and a persisted completed result can be replayed after a crash without another provider call.

This is an implemented durability foundation. Complete provider-specific recovery, actual usage and production observability remain hardening work.

## Continuity flow

Provider output uses stable keys:

```text
characters[].key
locations[].key
scenes[].characters[].character_key
scenes[].location_key
```

Schema validation rejects dangling references. The worker resolves/materializes project identities and then writes Scene relations using durable IDs, not display names.

```text
AI character key -> ProjectCharacter -> Character/CharacterVersion
AI location key  -> ProjectLocation
Scene            -> scene_characters -> ProjectCharacter
Scene            -> Location reference
```

This analysis-time continuity persistence is implemented. Full Character reference/lock/review semantics required by downstream media generation remain separate work.

## Snapshot consistency

Before materialization:

```text
chapter.id == job.chapterId
chapter.storyVersionId == job.storyVersionId
chapter.rowVersion == job.chapterRowVersion
chapter.sourceHash == job.sourceHash
```

If the Chapter changed, stale output is not applied to the new source.

## Redis loss/replay

Redis generation messages are wake-up/delivery hints. Durable queued/recoverable work remains discoverable from PostgreSQL, so losing Redis delivery must not lose a job.

Spring Session is a different availability concern: losing session data may require re-authentication.

## Frontend flow

```text
edit Chapter -> dirty -> Analyze disabled
save -> new persisted rowVersion/sourceHash
Analyze -> durable job
poll GenerationJob
COMPLETED -> refresh Storyboard/continuity queries
```

API mode must not synthesize progress or continuity state from fixtures.

## Media boundary

Image generation, TTS/subtitles and FFmpeg render/export are downstream stages and remain `PENDING`. They must consume reviewed/versioned continuity/storyboard state and use durable ProviderOperation/Asset/FinalArtifact contracts rather than calling providers directly from UI/backend request threads.

Durable media follows this target flow:

```text
provider/render result
  -> worker local scratch
  -> validate media payload
  -> upload immutable object to Cloudflare R2
  -> persist Asset/MediaAsset metadata in PostgreSQL
  -> mark producing stage complete
  -> delete local scratch when safe
```

The R2 object, not a worker-local path, is the durable media payload. A retry or reclaimed job should reuse a valid already-persisted R2 object rather than regenerate it solely because local scratch was lost. Development, staging and production use environment-isolated R2 buckets rather than a local object-storage implementation.

## Remaining durability/release work

- Complete actual provider usage and billing-ledger reconciliation/release.
- Broader provider-specific recovery/observability evidence.
- Full Character reference/version-lock workflow.
- Approved storyboard reset/versioning workflow.
- Media generation/finalization pipeline.
- Broader moderation/consent/abuse, deletion/retention and backup/restore evidence.
