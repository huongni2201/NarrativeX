 # NarrativeX V1.7 — Domain Model

 ## 1. Bounded responsibility

 Core business chạy trong Spring Boot Modular Monolith; Python 3.12 AI/Media Worker xử lý job; PostgreSQL là authoritative state; Redis chỉ queue/cache/progress/scheduling; MinIO/S3-compatible storage giữ binary. Provider/model nằm sau port/adapter. Character consistency là data/version/state, không phải prompt cố định.

 ## 2. Aggregate và entity chính

 | Aggregate/entity | Trường hoặc trách nhiệm chính |
 |---|---|
 | User | identity, email, locale/preferences, status; sở hữu project và template |
 | ExternalIdentity | Google OIDC provider/subject/claims; không chứa provider secret |
 | Project | owner, status, active StoryVersion, default ImageGenerationSettings, row_version |
 | StoryVersion | project, version_no, raw_text, status, source language, rights attestation |
 | Character | project, name, role, status |
 | CharacterVersion | immutable bible/prompt/reference snapshot, status, lock, row_version |
 | CharacterMaster/Reference | identity source, view/weight/status; sensitive khi real-person |
 | OutfitVersion | outfit riêng identity, version/status/reference |
 | CharacterTemplate/Version | user library immutable template; import vào project thành snapshot |
 | Location/LocationReference | project-level environment bible và reference |
 | ProjectStyleProfile | style/negative prompt/aspect/version |
 | Chapter | StoryVersion boundary, order/title |
 | Scene | chapter, order, narration, duration, row_version, status |
 | Shot | scene, order, camera/visual intent/duration/approved asset |
 | VisualBeat | scene timeline, narration segment, visual intent, location, row_version; generation unit |
 | VisualBeatCharacter | beat + CharacterVersion + OutfitVersion + role in frame |
 | Asset | storage metadata/type/checksum/dimensions/duration/status; binary ngoài DB |
 | GenerationJob | parent async job, requested/billed user, operation plan, resource class, status/progress |
 | StageAttempt | stage lifecycle, attempt no, worker lease/heartbeat, error |
 | ProviderOperation | durable provider submission; provider namespace, operation id, status, fingerprint |
 | GenerationAttempt | image request/output snapshot, resolved prompt, model/workflow, settings, status |
 | IdentityCheck | reference snapshot, score/result/method; supporting signal only |
 | AudioTrack/SubtitleSegment | narration/music asset, voice, timeline text/start/end |
 | RenderProfile | ratio, dimensions, FPS, bitrates; immutable profile config |
 | RenderVersion | immutable project render snapshot, profile, manifest, output |
 | FinalArtifact | validated immutable video artifact, MIME/dimensions/duration/manifest |
 | ShortCandidate | ranked highlight range, score/reason/status |
 | ShortClip/ShortVisualItem | independent short timeline, source beat/asset, crop, profile, final artifact |
 | ImageGenerationProfile | ratio + quality tier + provider option mapping |
 | VisualGenerationOverride | optional beat/shot ratio/tier/crop strategy; inherit if null |
 | KeyframeAsset/MotionAsset | still/source visual vs deterministic/AI motion output |
 | VideoGenerationAttempt | video provider/model/duration/mode/cost/output snapshot |
 | OperationPlan | affected scope, duration/complexity, visual/motion actions, estimate, confidence, cap |
 | CostEstimateItem | stage/provider/model/quantity/rate version/range |
 | CostReservation | reserved, consumed, released amount/credits and lifecycle |
 | ResourceUsageRecord | provider/GPU/CPU/storage/egress quantities and internal/billable cost |
 | UsageLedger/UsageWindow | append-only accounting and atomic plan-period counters |
 | PlanEntitlement/UserPlanAssignment | versioned watermark/quality/export/concurrency/features |
 | Notification/Preference | persisted in-app event and email/channel preferences |
 | OutboxEvent | transactionally persisted event, idempotency key, dispatch state |
 | ErrorCatalog | stable error code/category/retryable/user message/action/visibility |
 | ContentRightsAttestation | rights basis, policy version, accepted/revoked time |
 | ModerationDecision | input/output direction, SAFE/REVIEW/BLOCK, categories, provider signal, policy |
 | IdentityConsent/IdentityProfile | consent basis/reference type and private retention-bound identity template |
 | AIAuditEvent | capability/provider/model/prompt/schema/safety versions, fingerprint, usage/params |
 | DataDeletionRequest | account/project/asset scope, durable workflow status and retention deadline |
 | AbuseEvent | user/session/IP hash, route/signal, allow/throttle/block/challenge, policy version |

 ## 3. Relationship and snapshot rules

 ```text
 User 1──* Project 1──* StoryVersion 1──* Chapter 1──* Scene 1──* VisualBeat 1──* GenerationAttempt
 Project 1──* Character 1──* CharacterVersion 1──* ReferenceAsset
 VisualBeat *──* CharacterVersion + OutfitVersion + Location/StyleProfile
 Project 1──* OperationPlan 1──* GenerationJob 1──* StageAttempt 0──* ProviderOperation
 VisualBeat 0──1 KeyframeAsset + 0──1 MotionAsset → RenderVersion → FinalArtifact
 OperationPlan 1──* CostEstimateItem + 1──1 CostReservation → UsageLedger/ResourceUsageRecord
 Job/Render terminal transition → OutboxEvent → Notification → optional email
 ```

 - Project dùng Character/Location/Style xuyên chapter nhưng mỗi generation snapshot version/reference đã resolve.
 - Library import tạo `project_character_imports` và local CharacterVersion; library update không cascade.
 - GenerationAttempt, VideoGenerationAttempt, RenderVersion, FinalArtifact và APPROVED asset là lịch sử/snapshot; thay đổi tạo record mới.
 - `OUTDATED` chỉ biểu thị snapshot không còn khớp dependency mới; không xóa binary/export tự động.

 ## 4. State machine canonical

 | Entity | States |
 |---|---|
 | Project | DRAFT → PREPARING → READY → RENDERING → COMPLETED / ARCHIVED |
 | CharacterVersion | DRAFT → GENERATING → REVIEW → LOCKED / REJECTED |
 | Scene/Shot | DRAFT → READY_FOR_VISUAL → GENERATING → REVIEW → APPROVED / FAILED / OUTDATED |
 | VisualBeat | PROPOSED → READY_FOR_VISUAL → GENERATING → REVIEW → APPROVED / REJECTED / OUTDATED |
 | GenerationJob | QUEUED → RUNNING → COMPLETED / FAILED / CANCELED |
 | StageAttempt | QUEUED → RUNNING → COMPLETED / FAILED / CANCELED; mất lease → STALLED |
 | ProviderOperation | RESERVED → SUBMITTED → RUNNING → COMPLETED / FAILED / UNKNOWN |
 | RenderVersion | QUEUED → PREPARING → RENDERING → UPLOADING → COMPLETED / FAILED |
 | FinalArtifact | PENDING → VALIDATING → READY / INVALID |
 | ShortClip | DRAFT → PLANNING → READY → RENDERING → REVIEW → APPROVED / FAILED / OUTDATED |
 | OperationPlan | DRAFT → ESTIMATED → RESERVED → RUNNING → PAUSED_COST_LIMIT / RECONFIRMATION_REQUIRED → COMPLETED / CANCELED |
 | VideoGenerationAttempt | QUEUED → SUBMITTED → RUNNING → REVIEW → APPROVED / REJECTED / FAILED / UNKNOWN |

 State transitions must be auditable, idempotent and guarded by ownership, policy, row_version and required predecessor state.

 ## 5. Settings và immutable resolution

 `ImageGenerationSettings` gồm `aspect_ratio` + `quality_tier`; project default được resolve rồi beat/shot override. Capability registry quyết định ratio/quality/provider options hợp lệ. Attempt lưu requested settings, resolved provider request, actual dimensions, prompt/schema/model/workflow/policy versions và cost inputs. `RenderProfile` độc lập với image tier, map ratio + Standard/High thành dimensions chuẩn; manifest snapshot crop/reframe strategy.

 ## 6. Operation và accounting model

 `OperationPlan` là aggregate boundary cho expensive work. Nó giữ affected scope, estimate range/confidence/ETA, provider/model/rate version, reusable assets, max authorized spend và user attribution. `CostReservation` được ghi trước provider/GPU work; stage tiếp theo chỉ chạy nếu cap còn đủ. `ResourceUsageRecord` ghi provider cost, gpu_seconds, cpu_seconds, storage/egress, internal cost và billable cost. Ledger append-only, idempotency key và billed user luôn hiện diện kể cả admin/internal operation.

 ## 7. Concurrency và eventing

 Mutable entities dùng `row_version`/ETag; expected version mismatch trả 409. LOCKED/APPROVED/completed snapshot không update tại chỗ. Terminal render event được ghi trong transactional outbox cùng business transaction, sau đó dispatcher tạo Notification theo unique event key và email theo preference. Notification là source of truth; email/web-push chỉ là delivery channel.

 ## 8. Safety/privacy/deletion aggregates

 `ModerationDecision` là canonical application outcome, không để provider signal tự quyết định publish. `ContentRightsAttestation` active là prerequisite; `IdentityConsent` bắt buộc cho REAL_PERSON_REFERENCE. `IdentityProfile` private/tenant-isolated, không log/public/cross-user reuse, có expires/deleted timestamp. `DataDeletionRequest` chặn job mới, cancel/reconcile, revoke signed URLs, expire/delete derivatives/identity data, quarantine late provider result và hoàn tất theo retention/backup policy.
