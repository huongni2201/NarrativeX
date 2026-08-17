 # NarrativeX — Roadmap và release plan V1.7

 **Ngày đặc tả:** 17/08/2026 · **Mục tiêu:** production-ready image-first story video studio.

 ## Release baseline

 | Gate | Nội dung bắt buộc | Planning envelope |
 |---|---|---|
 | Internal MVP | Story → analysis → character/storyboard → image/TTS → FFmpeg; fake + limited real smoke | 4–6 tuần với team nhỏ đã có baseline |
 | Creator MVP / Staging | Google auth, durable jobs, cost controls, batch review, Shorts baseline, real-provider E2E, staging CI/CD | 8–12 tuần cumulative |
 | Production-ready Beta (V1.7) | Trust & Safety, abuse limit, privacy/deletion, backup/restore, observability, provider resilience, entitlement, chapter continuation và notification outbox | 14–20 tuần cumulative |
 | Scale hardening | Capacity tuning, selected AI-video, routing, storage lifecycle, billing/analytics reconciliation | +6–10 tuần sau beta theo usage thực tế |

 Các mốc là planning envelope, không phải cam kết sprint. Mỗi gate cần acceptance kỹ thuật + product + cost + safety.

 ## V1.7 production scope

 1. **Durable core:** Google OIDC, ownership, StoryVersion, semantic scene/beat planning, CharacterVersion lock, Outfit/Project Bible, image/TTS/subtitle/FFmpeg và FinalArtifact validation.
 2. **Creator control:** review grid, batch approve/reject/regenerate, prompt inspector, animatic, chapter/incremental render, ShortCandidate/ShortClip.
 3. **Cost and operations:** OperationPlan, affected scope, asset reuse, estimate range/confidence/ETA, CostReservation, max spend, dynamic re-estimation, usage ledger, resource accounting.
 4. **Reliability:** provider reservation/UNKNOWN reconciliation, retry caps, resource scheduler, per-user fairness, provider rate limit/circuit breaker, lease/watchdog, atomic finalization, error catalog.
 5. **Product platform:** aspect/quality settings, output profiles, notification/outbox, plan entitlement, watermark/exports/concurrency, optimistic locking/409 UX, i18n baseline.
 6. **Trust & Safety:** input/output moderation, rights attestation/takedown, prompt-injection defense, real-person consent/identity privacy, account abuse limiting, AI audit, deletion lifecycle.
 7. **Provider path:** Vertex AI Gemini production adapter via ADC/workload identity; VideoGenerationProvider/MotionAsset contract sẵn sàng nhưng AI video chỉ bật khi quality/cost/safety gate đạt.

 ## Historical progression

 | Version | Delivered / planned capability |
 |---|---|
 | V1.1 | Style presets, Location/Outfit Bible, Identity QA nâng cao, auto merge/split, batch generation, prompt editor, usage dashboard. |
 | V1.2 | AI video cho selected shots; Economy/Balanced/Cinematic mode. |
 | V1.5 | Vertex Gemini production, dynamic operation cost, per-user accounting, delta/reuse, batch review, prompt inspector, animatic, watchdog/resiliency. |
 | **V1.7** | **Trust & Safety production layer, rights/consent/privacy, abuse protection, deletion lifecycle, AI audit, vi-VN/en-US i18n, entitlement, chapter continuation và selected-beat provider path.** |

 ## Next after V1.7

 | Version | Scope | Entry criteria |
 |---|---|---|
 | V2 | Collaboration, sharing, advanced timeline editor, provider routing. | Stable optimistic locking, ownership/sharing model và usage telemetry. |
 | V2.1 | Character LoRA/adapter personalization, regional/inpaint multi-character. | Volume/quality evidence chứng minh reference-based conditioning chưa đủ. |
 | V2.2 | Billing reconciliation analytics, routing optimization, cold storage, optional Vertex batch/provisioned throughput. | Measured volume/cost justify. |
 | V3 | Tách Generation/Render service nếu bottleneck thật, multi-region GPU, marketplace/autoscaling nâng cao. | Operational bottleneck và ownership/deployment boundary thực tế. |

 ## Cost and capacity plan

 | Hạng mục | Planning envelope / policy |
 |---|---|
 | Local/dev fixed infra | $30–$150/tháng; không tính paid generation experiments. |
 | Staging fixed infra | $80–$300/tháng; data/secrets tách production. |
 | Early production fixed infra | $150–$600/tháng; chưa gồm variable AI/TTS/video hay dedicated GPU. |
 | Variable AI/media | Tính động qua OperationPlan theo duration, complexity, delta, reuse, provider/model/quality; reserve trước, reconcile sau. |
 | Self-hosted GPU | Capacity-driven, có gpu_seconds/max concurrency; chỉ bật khi benchmark chứng minh hợp lý. Managed-provider mode có thể scale GPU pool về 0. |

 Không có giá cố định cho mỗi video hay quy tắc “1 giờ = 150 ảnh”. Visual budget là planner output; internal cost và billable cost được ghi riêng.

 ## Release blockers

 - P0/P1 security/safety chưa đóng, real-provider E2E chưa xác minh, hoặc prompt-injection test chưa pass.
 - Account rate limit, per-user attribution, entitlement hoặc spending cap chưa enforce server-side.
 - Deletion/retention/consent chưa chạy end-to-end.
 - Backup/restore, FinalArtifact atomicity, UNKNOWN reconciliation hoặc audit còn mất dữ liệu.
 - AI video chưa có benchmark hoặc fallback image-first/cost/safety chưa đạt thì feature flag phải tắt.
