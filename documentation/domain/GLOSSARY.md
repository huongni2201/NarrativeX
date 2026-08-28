# NarrativeX V1.11 — Glossary

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`  
**Status evidence:** `../TRACEABILITY.md`

Terms below distinguish current runtime concepts from target/deferred concepts so historical vocabulary is not mistaken for implemented behavior.

## Source and storyboard

| Term | Definition |
| --- | --- |
| StoryVersion | Versioned persisted story content associated with a Project; current Chapter source belongs to a StoryVersion. |
| Chapter | Primary saved source unit for current Analyze/narration workflows. `source_text + source_hash + row_version` form the important execution identity. |
| StoryboardRevision | Versioned Scene/VisualBeat snapshot for one Chapter source identity. |
| Scene | Ordered semantic storyboard phase under a Chapter revision; not a requirement to prerender a `scene.mp4`. |
| VisualBeat | Smallest semantic production/timeline unit with stable visual intent. It may later receive exact source/audio timing and selected image/video media. |
| Shot | Optional finer-grained camera term. Current product hierarchy does not require a separate persisted Shot entity for every VisualBeat. |
| Source Span | Contiguous portion of Chapter source associated with a semantic unit. Exact VisualBeat source-span materialization is TARGET at the audited checkpoint. |
| `text_start/text_end` | Numeric VisualBeat source offsets. Approved target convention is UTF-16 half-open `[start,end)` over the exact persisted Chapter source snapshot; not yet populated for every analyzed beat. |
| `audio_start_ms/audio_end_ms` | VisualBeat-local Chapter narration offsets. Exact only when derived from compatible narration alignment or immutable production planning; currently not reconciled for every storyboard beat. |
| Provisional / Fallback Timing | Navigable timeline geometry used when exact beat timing is incomplete. It must not be labeled exact narration alignment. |
| Aligned Timing | Exact beat audio timing derived from compatible real narration alignment. This is a TARGET for draft storyboard beats until reconciliation is implemented/verified. |
| Planned Timing | Timing in a current immutable MediaPlan/production snapshot; authoritative for production/render planning. |

## Character continuity

| Term | Definition |
| --- | --- |
| Character | Canonical reusable Character identity owned at user/workspace scope; may participate in many Projects. |
| ProjectCharacter | Assignment of a Character to one Project; carries role/importance/project aliases/groups/story metadata and optional pinned CharacterVersion. |
| CharacterVersion | Versioned Character bible + visual prompt snapshot. Explicitly pinned versions are not silently replaced by later AI analysis. |
| CharacterAppearance | Project/timeline appearance state such as age state, hairstyle, injury, wardrobe context and appearance prompt; not a new Character identity. |
| Character Bible | Stable source-grounded continuity description used by CharacterVersion. |
| Visual Prompt | Reusable source-grounded visual identity description for Character generation/reference workflows. |
| SceneCharacter | Relation from Scene to participating ProjectCharacter. |
| VisualBeatCharacter | Relation from VisualBeat to a visible ProjectCharacter with role `PRIMARY`, `SECONDARY`, or `BACKGROUND`. |
| Beat Character Role | Visual participation priority, not a Character identity class. `PRIMARY` identifies visually important subjects; `SECONDARY` participates; `BACKGROUND` is visible but less identity-critical. |
| CharacterTemplate | Optional reusable template/catalog input for creating Character state. It is not the runtime Character identity itself and is not required to be cloned per Project. |
| Character Reference Asset | Approved/source-owned image used to condition Character identity consistency in supported generation flows. |
| Identity Anchor | Preferred Character reference role/asset used for conditioning; not a separate canonical Character identity. |
| Project Character Library | Project-scoped view of ProjectCharacter assignments and their continuity/reference state. |
| Global Character Library | User/workspace-scoped reusable Character identities; product UX may call this a Character Hub/Library. |
| OutfitVersion | Versioned wardrobe asset/state separated from canonical Character identity where used. |

## Narration and audio

| Term | Definition |
| --- | --- |
| NarrationStrategy | `TTS` or `USER_PROVIDED_AUDIO`. User-provided audio bypasses TTS for the covered scope. |
| NarrationRequest | Source-hash-bound request for generated narration, including voice/language/rate inputs. |
| NarrationAsset | Durable metadata for generated narration audio; project bytes are materialized locally for Desktop use. |
| NarrationAlignment | Source-hash-bound mapping of text spans to audio milliseconds. Persistence is IMPLEMENTED foundation. |
| AlignmentSpan | A span carrying `textStart/textEnd` and `audioStartMs/audioEndMs`. |
| NarrationSet / NarrationPart | Foundations for one logical narration timeline assembled from ordered user/generated audio parts. Arbitrary multi-part production coverage remains PARTIAL. |
| AlignmentRun | Broader document/audio alignment-run metadata for multi-part narration foundations, including confidence/coverage/status. |
| Master Clock | Real compatible narration timing is the intended visual playback/timeline authority. Fallback geometry is not a master-clock substitute. |

## Generation and provider lifecycle

| Term | Definition |
| --- | --- |
| OperationPlan | Backend-authorized operation/cost scope. |
| MediaPlan | Immutable backend-authorized production/media planning snapshot. |
| GenerationJob | Durable parent execution record. |
| StageAttempt | Durable attempt for a stage within a GenerationJob, with claim/lease/lifecycle state. |
| ProviderOperation | Durable record created before/around an external provider boundary, including submission/result identity and reconciliation status. |
| UNKNOWN | External provider acceptance/outcome is ambiguous; blind resubmission is forbidden until reconciliation. |
| GenerationAttempt | A concrete generation attempt/output lineage concept; durable implementation depends on the workflow. |
| Affected Scope | Exact Chapter/Scene/Beat/media/audio scope affected by a mutation; used for incremental work and review. |
| Cost Reservation | Authorized credit/cost ceiling reserved before expensive work and reconciled/released later. |
| Actual Cost | Observed provider/compute usage; distinct from estimate/reservation. Complete actual-usage reconciliation remains PARTIAL. |
| Entitlement | Backend-enforced feature/usage capability. Renderer state cannot grant it. |

## Media and rendering

| Term | Definition |
| --- | --- |
| MediaAsset | Stable generated/imported media identity and metadata. Binary bytes are not stored in PostgreSQL. |
| Approved Asset | User/policy-selected media considered approved for reuse/production. |
| ProductionBeatMediaSelection | Durable selected MediaAsset + supported fit/trim state for a Project/VisualBeat. |
| KeyframeAsset | Approved/source image used for still/basic motion or optional image-to-video workflows. |
| MotionAsset | Playable motion media, either deterministic image-motion output or a generated/imported video depending on workflow. |
| `IMAGE_MOTION` | Production mode using deterministic image motion; must not silently schedule I2V. |
| `HYBRID_LOCAL_I2V` | Deferred/fast-follow production mode allowing selected authorized I2V while keeping deterministic image motion as fallback/default. |
| `BASIC_IMAGE_MOTION` | Deterministic image-motion execution strategy. |
| `IMAGE_TO_VIDEO` | Optional authorized motion strategy; not required for the core Desktop creator loop. |
| Fit Mode | Supported media-fit choice such as `TRIM`, `LOOP`, `FREEZE_END`, or `SPEED_ADJUST` for applicable video/media behavior. |
| FinalArtifact | Backend metadata for a validated final render. Final MP4 bytes remain in Desktop local project artifacts. |
| Render Snapshot | Immutable backend-authorized input snapshot for a final local render. |
| Render Journal | Local `render.state.json` execution journal used for recovery/discovery; not a second business database. |
| Segment Cache | Local immutable-input render cache for reusable rendered segments; disposable and not durable domain authority. |
| RenderProfile | Output settings/preset such as aspect ratio, dimensions, FPS/quality where supported. |
| Short/Reel | Derived vertical/local artifact generated from approved source/timeline state without mutating the long-form source artifact. |

## Storage and runtime boundaries

| Term | Definition |
| --- | --- |
| ProjectStorage | Electron-main-owned local project workspace under `<userData>/projects/<projectId>`. |
| `project.manifest.json` | Local index mapping stable IDs to project-relative path + size/SHA-256; not a second domain database. |
| R2 | Cloudflare R2 generated-media transport/durability when remote provider/worker execution requires it. Not the final-video store. |
| Worker Scratch | Ephemeral worker-local files/cache. Never a durable project identity. |
| Local Final Artifact | Final MP4 written by Electron main under project artifacts; backend stores only metadata/state. |
| Desktop Guest Identity | Installation-scoped internal ownership/session identity; not an end-user login provider. |
| User Session | Backend-authenticated account session. Google is the only account sign-in provider. |
| Device Credential | Separate local-execution device identity/credential used for assigned render work; not a user session. |

## Security and policy

| Term | Definition |
| --- | --- |
| Prompt Injection | Untrusted content attempting to alter system/tool/ownership/policy instructions; handled through data boundaries, schemas and allowlists. |
| Moderation Decision | `SAFE`, `REVIEW`, or `BLOCK` policy result; separate from StoryVersion/job lifecycle. |
| Real-person Reference | Reference media involving a real person; consent/use-right/privacy/retention requirements apply. |
| Fictional Reference | Fictional/generated reference media; still subject to ownership/safety policy but not treated identically to real-person identity data. |
| Optimistic Lock / `row_version` | Mutation succeeds only against the expected persisted version; stale writes conflict. |
| ETag / If-Match | HTTP representation concurrency token where exposed by an API. |
| Transactional Outbox | Durable event persisted with the owning business transaction before asynchronous delivery. |

## Canonical status vocabulary

- Job lifecycle: `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELED` plus workflow-specific stalled/paused states.
- Provider operation: `RESERVED`, `SUBMITTED`, `RUNNING`, `COMPLETED`, `FAILED`, `UNKNOWN`.
- Moderation: `SAFE`, `REVIEW`, `BLOCK`.
- Documentation/capability evidence: `IMPLEMENTED`, `IMPLEMENTED foundation`, `PARTIAL`, `TARGET`, `DEFERRED`.
- Plan lifecycle: `ACTIVE`, `COMPLETED`, `SUPERSEDED`.

Do not use `TARGET` as if it were runtime status, and do not use an ACTIVE plan as proof that the described code already exists.
