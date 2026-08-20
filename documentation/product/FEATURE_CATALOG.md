# NarrativeX V1.8 — Feature Catalog

**Phạm vi:** V1.8 product contract ngày 18/08/2026. Các ID FR-01—FR-85 được giữ lại từ V1.7 trừ khi đặc tả V1.8 diễn giải khác; số liệu launch là configuration có version, không phải hằng số rải trong domain.

 ## Core product (FR-01—FR-20)

| ID | Nhóm | Yêu cầu V1.8 |
 |---|---|---|
 | FR-01 | Authentication | Google OIDC + HttpOnly server session + CSRF; password login/register có server-side abuse limiting. JWT/accessToken/refreshToken là migration riêng về sau, chưa thuộc runtime hiện tại. |
 | FR-02 | Project | Tạo, rename, archive, duplicate project. |
 | FR-03 | Story input | Paste/import và lưu StoryVersion. |
 | FR-04 | Analysis | Phân tích character/location/chapter/scene; semantic split. |
 | FR-05 | Character Bible | Structured character description + visual prompt. |
 | FR-06 | Character reference | Generate/upload reference, nhiều góc nhìn. |
 | FR-07 | Character lock | Lock CharacterVersion dùng cho scene generation. |
 | FR-08 | Storyboard | Sắp xếp/chỉnh Scene/VisualBeat/Shot; merge/split theo narration/complexity. |
 | FR-09 | Prompt build | Ghép character/location/scene/style/camera. |
 | FR-10 | Image generation | Worker/provider adapter; snapshot settings/attempt/provider operation; lưu object storage. |
 | FR-11 | Regenerate | Regenerate đúng một shot/beat, giữ attempt cũ. |
 | FR-12 | Voice | TTS narration theo scene/chapter. |
 | FR-13 | Subtitle | Segment subtitle + timing. |
 | FR-14 | Scene render | Image/motion/voice/music/subtitle theo RenderProfile. |
 | FR-15 | Project render | Scene/chapter → FinalArtifact MP4, Standard 720p/High 1080p theo entitlement. |
 | FR-16 | Job tracking | Parent/stage progress; terminal states và provider UNKNOWN. |
 | FR-17 | Asset library | Image/audio/video theo project/entity. |
 | FR-18 | Export | Long-form MP4, Short MP4 và manifest/metadata. |
 | FR-19 | Usage/quota | Credit/resource counter tối thiểu; append-only ledger. |
 | FR-20 | Admin | Retry/cancel, disable provider/model, xem structured error. |

 ## Storyboard, consistency và media (FR-21—FR-40)

| ID | Nhóm | Yêu cầu V1.8 |
 |---|---|---|
 | FR-21 | Visual planning | Tạo VisualBeat theo visual change, không 1 câu = 1 ảnh. |
 | FR-22 | Outfit Bible | Outfit version tách identity; scene chọn outfit. |
 | FR-23 | Project Bible | Character/Location/Style dùng xuyên chapter. |
 | FR-24 | Identity QA | Score/flag identity trước approve; không thay human decision. |
 | FR-25 | Chapter render | Retry độc lập, giữ scene clip thành công. |
 | FR-26 | Multi-character | Chỉ định CharacterVersion từng nhân vật; region/inpaint là workflow nâng cao. |
 | FR-27 | Video profile | Ratio 16:9/9:16/1:1/4:3/3:4 + Standard/High mapping chuẩn; video quality độc lập image quality. |
 | FR-28 | Provider operation | Reserve trước submit; lưu provider/op id/status; reconcile. |
 | FR-29 | Artifact validation | Parent chỉ complete khi artifact/storage/MIME/dimensions hợp lệ. |
 | FR-30 | Short discovery | Rank highlight candidate, không cắt interval cố định. |
 | FR-31 | Short planning | 9:16, density cao hơn; reuse/crop/generate theo complexity. |
 | FR-32 | Short render | MP4 độc lập, subtitle/audio; hard min 30s, default 45–60s. |
 | FR-33 | Adaptive density | Budget theo duration + complexity; không fixed image count. |
 | FR-34 | Provider health | Hiển thị config/access/billing/model health. |
 | FR-35 | Image ratio | Project default + beat/shot override; chỉ capability hiện tại. |
 | FR-36 | Image quality | DRAFT/STANDARD/HIGH; adapter map provider; STANDARD default. |
 | FR-37 | Per-beat override | Inherit/Override ratio/quality; cảnh báo crop/pad. |
 | FR-38 | Output ratio | User chọn output ratio + safe-area/crop preview. |
 | FR-39 | Notifications | Terminal render/Short tạo in-app; email opt-in; không cần giữ tab. |
 | FR-40 | Onboarding | Checklist và empty-state CTA/sample. |

 ## Entitlement, concurrency và cost (FR-41—FR-66)

| ID | Nhóm | Yêu cầu V1.8 |
 |---|---|---|
 | FR-41 | Plan entitlement | Backend trả và enforce watermark, max quality, exports, concurrency, flags. |
 | FR-42 | Export policy | FREE launch baseline: watermark, Standard 720p max, 1 long-form + 3 Short/tháng; paid theo config. |
 | FR-43 | Story limits | Reject trước persist/analyze ở limit cấu hình; mặc định 500k Unicode hoặc 120k estimated tokens, ngưỡng chạm trước; không truncate âm thầm. |
 | FR-44 | Frame guardrail | Tối đa 4 tracked named characters/beat; cảnh báo >3; >4 phải split/reframe/background. |
 | FR-45 | Optimistic concurrency | row_version/ETag; stale update 409; không overwrite. |
 | FR-46 | Cost accounting | Estimate provider/GPU/TTS/render/storage; lưu actual cost, gpu/cpu seconds, bytes. |
 | FR-47 | Attribution | requested_by và billed_to; trace user→project→operation→job→stage. |
 | FR-48 | Operation planning | Affected scope, duration/complexity, visual/motion, provider/model, range/confidence/ETA/input snapshot. |
 | FR-49 | Reservation/cap | Reserve trước execute; max_authorized_cost; pause khi stage tiếp theo vượt cap. |
 | FR-50 | Re-estimation | Re-estimate sau analyze/visual/provider; baseline 20% hoặc cap → reconfirm. |
 | FR-51 | Delta scope | Edit tính affected chapters/scenes/visuals/audio/clips; tách incremental/lifetime cost. |
 | FR-52 | Asset reuse | REUSE/REFRAME/BASIC_MOTION/NEW_IMAGE/AI_VIDEO trước estimate. |
 | FR-53 | Batch review | Batch approve/reject/regenerate; partial result, item conflict không rollback item hợp lệ. |
 | FR-54 | Prompt inspector | Auto prompt + structured override + submitted prompt; raw override có warning. |
 | FR-55 | Animatic | Browser animatic image/keyframe + audio/subtitle/timing/light motion trước encode. |
| FR-56 | Character library | Global Character Hub quản lý reusable Character identities; Project Character Library quản lý ProjectCharacter assignments. Assign Character vào Project không duplicate identity. Generation sử dụng immutable CharacterVersion/Appearance snapshot. |
 | FR-57 | Vertex Gemini | Story/scene/visual/prompt/highlight qua Vertex AI; ADC/workload identity; config server-side. |
 | FR-58 | Capability registry | Provider/model expose modes/aspect/resolution/duration/pricing; domain không vendor branch. |
 | FR-59 | Motion planning | STILL/BASIC_MOTION/AI_VIDEO; image-first fallback. |
 | FR-60 | Video providers | VideoGenerationProvider hỗ trợ Veo/Kling/tương lai; snapshot resolved provider/model/capability/pricing. |
 | FR-61 | AI-video budget | Optional budget/max seconds; rank narrative impact × motion need / cost. |
 | FR-62 | Scheduler | Resource classes + priority + per-user fairness. |
 | FR-63 | Provider resilience | Rate limit/circuit breaker theo provider/model/location/capability; auth/billing pause ngay. |
 | FR-64 | Worker watchdog | Lease/heartbeat; stale → STALLED; external submitted phải reconcile. |
 | FR-65 | Atomic finalization | Temp → validate → checksum/HEAD → immutable final key → READY. |
 | FR-66 | Error catalog | Structured code/category/retryable/message/action + technical correlation. |

 ## Trust, safety, privacy và localization (FR-67—FR-78)

| ID | Nhóm | Yêu cầu V1.8 |
 |---|---|---|
 | FR-67 | Input moderation | Story/character/prompt/reference trước planning/generation; SAFE/REVIEW/BLOCK + policy version; BLOCK không paid call. |
 | FR-68 | Output moderation | Image/video/text metadata trước APPROVED/PUBLISHABLE; normalize provider rejection. |
 | FR-69 | Copyright/report handling | Không yêu cầu blanket per-story rights-attestation checkbox trước Analyze/Generate; hỗ trợ report/review/disable/takedown và không để LLM tự kết luận license/public-domain. |
 | FR-70 | Injection defense | Untrusted boundary, structured schema, field/tool allowlist, optional Model Armor/equivalent. |
 | FR-71 | Real-person consent | `REAL_PERSON_REFERENCE` + consent/use-right basis trước identity processing. |
 | FR-72 | Identity privacy | Tenant isolation, encryption/private, no log/public/cross-user reuse, retention/deletion. |
 | FR-73 | Abuse protection | Password login/register có Redis rate limit theo IP + identity/IP; target production còn cần account/session/IP/route/resource-class, concurrent jobs và anomaly controls trước paid work. |
 | FR-74 | AI audit | Provider/model/version, prompt/schema/policy, safety, fingerprint/hash, usage/params/correlation. |
 | FR-75 | Deletion | Cancel/reconcile, revoke access/URLs, expire assets/identity, audit, backup retention. |
 | FR-76 | I18n | vi-VN/en-US; stable codes/message keys; source/narration/metadata language độc lập. |
 | FR-77 | Review/appeal | REVIEW queue; hard-block minors không override; category khác có workflow/audit. |
 | FR-78 | Safety normalization | Adapter normalize provider signal; application policy là canonical. |

 ## Chapter-first và incremental continuation (FR-79—FR-85)

| ID | Nhóm | Yêu cầu V1.8 |
 |---|---|---|
 | FR-79 | Chapter management | Tạo, sửa, đổi thứ tự Chapter với optimistic locking và liên kết StoryVersion nguồn. |
 | FR-80 | Incremental continuation | Nhập thêm Chapter theo nhiều đợt; inherit Bible, locked CharacterVersion, Location, Style và generation settings theo snapshot. |
 | FR-81 | Chapter lifecycle | DRAFT → ANALYZED → VISUAL_READY → RENDERED; readiness phản ánh trạng thái bền vững, không suy ra từ counter tạm. |
 | FR-82 | Chapter resume/progress | Resume/retry theo Chapter, durable progress và không tạo job trùng khi reconnect/worker restart. |
 | FR-83 | Chapter render scope | Render Chapter hoặc Full Project; chỉ enqueue affected/new scope khi thêm/sửa Chapter. |
 | FR-84 | Character appearance | Quản lý nhiều visual states/appearances của cùng Character theo chapter/timeline mà không duplicate identity. |
| FR-85 | Character context resolution | Scene/VisualBeat generation chỉ resolve participating characters và required references; không inject toàn bộ project/global library vào AI context. |

 ## Non-functional release expectations

 PostgreSQL authoritative state; Redis queue/cache/progress/scheduling và transient abuse-control counters; Cloudflare R2 binary object storage; async workers; production real adapters; backup/PITR/restore drill; structured observability; no shared lower/prod secrets/data; P0/P1 safety/security blockers block public launch.
