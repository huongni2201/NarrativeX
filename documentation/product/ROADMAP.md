# NarrativeX — Roadmap và release plan V1.8

**Ngày đặc tả:** 18/08/2026 · **Mục tiêu:** production-ready image-first story video studio.

## Release baseline

| Gate | Nội dung bắt buộc | Planning envelope |
|---|---|---|
| Internal MVP | Chapter source → durable analysis → Character/Storyboard → image/TTS → FFmpeg | 4–6 tuần với team nhỏ đã có baseline |
| Creator MVP / Staging | Google auth, password-auth abuse limiting, durable jobs, cost controls, batch review, Shorts baseline, real-provider E2E, staging CI/CD | 8–12 tuần cumulative |
| Production-ready Beta (V1.8) | Trust & Safety, broader abuse controls, privacy/deletion, backup/restore, observability, provider resilience, entitlement, chapter continuation và notification outbox | 14–20 tuần cumulative |
| Scale hardening | Capacity tuning, selected AI-video, routing, storage lifecycle, billing/analytics reconciliation | +6–10 tuần sau beta theo usage thực tế |

Các mốc là planning envelope, không phải cam kết sprint. Mỗi gate cần acceptance kỹ thuật + product + cost + safety.

## Current implementation checkpoint — Chapter Analysis Vertical Slice

PR #38 implements the first real Internal-MVP product slice:

```text
Create Project
  -> Create/Edit Chapter
  -> Save persisted Chapter
  -> Analyze
  -> durable GenerationJob
  -> worker claim/lease/heartbeat
  -> Vertex Gemini structured analysis
  -> Character / ProjectCharacter / CharacterVersion
  -> Scene / VisualBeat
  -> COMPLETED
```

Current state is **IMPLEMENTED FOUNDATION / VERIFICATION**, not production-ready. The draft PR still requires clean CI, PostgreSQL integration/E2E verification, real Vertex smoke verification and follow-up read APIs before the analysis result is fully consumable in the UI.

### What is now inside the Internal MVP foundation

- Persisted Chapter `sourceText`, `sourceHash`, `rowVersion`.
- Explicit Chapter Analyze action; Project creation and Chapter save do not auto-trigger AI.
- Durable backend transaction for `OperationPlan + GenerationJob + StageAttempt + OutboxEvent`.
- PostgreSQL Chapter snapshot stored on GenerationJob.
- Idempotency based on persisted Chapter source identity.
- Redis as post-commit delivery hint only.
- Worker PostgreSQL claim with lease/heartbeat and stale-lease recovery foundation.
- `ChapterAnalysisRequest` without blanket rights-attestation fields.
- One real Vertex Gemini adapter using ADC and structured JSON validation.
- AI result materialization into Character and Storyboard foundation tables.
- Frontend Analyze button and GenerationJob polling.

### Still required before Chapter Analysis milestone is DONE

1. Backend, Worker and Frontend CI all green.
2. PostgreSQL E2E: saved Chapter → Analyze → `QUEUED → RUNNING → COMPLETED`.
3. Assert Character/ProjectCharacter/CharacterVersion and Scene/VisualBeat rows after completion.
4. Stale `rowVersion/sourceHash` result rejection test.
5. Worker restart/stale lease recovery test without duplicate materialization.
6. Real Vertex structured-output smoke test.
7. Dedicated durable `ProviderOperation` persistence + `UNKNOWN` reconciliation before production-grade external retry/resubmit guarantees.
8. Public Character and Storyboard read APIs + frontend query integration.

## Internal MVP implementation order

### M0 — Foundation — mostly complete

- Authentication/session/CSRF.
- Project create/list/detail.
- StoryVersion foundation.
- Chapter CRUD/source persistence.
- Character/Storyboard domain/persistence foundations.
- Generation domain scaffold.

### M1 — Chapter Analysis — current priority

```text
Chapter.sourceText
  -> Analyze
  -> durable job
  -> LLM structured analysis
  -> Character + Scene + VisualBeat
```

**Current status:** implementation foundation exists on PR #38; verification/read APIs remain.

M1 is complete only when the user can save a Chapter, analyze it, observe a real terminal job, and then read the resulting Characters and Storyboard from backend APIs without fixture/mock data.

### M2 — Character Review

After M1:

- project-scoped Character list/detail API;
- CharacterVersion view/edit;
- approve/lock Character identity;
- project usage/aliases/role editing;
- UI consumes backend data only.

Do not introduce LoRA/training in MVP.

### M3 — Storyboard Review

After M1:

- Scene/VisualBeat list/detail read API;
- edit narration/title/visual intent;
- reorder where required;
- review/approve lifecycle;
- mark old analysis output outdated instead of deleting approved downstream media once generation exists.

### M4 — Image Generation

Only after analysis/storyboard review is stable:

```text
Approved VisualBeat
  -> one ImageGenerationProvider
  -> private MinIO/S3 object
  -> Asset metadata
  -> review/regenerate
```

MVP uses one provider, not multi-provider routing.

### M5 — Narration / TTS

- one TTS adapter;
- Scene narration → audio asset;
- basic timing/subtitle data;
- provider output validation and duration metadata.

### M6 — FFmpeg Render

- approved image/visual asset;
- narration audio;
- subtitle timing;
- basic pan/zoom/fade;
- MP4 FinalArtifact;
- checksum/manifest validation before READY.

At the end of M6 the Internal MVP should support:

```text
Login
  -> Create Project
  -> Create/Edit Chapter
  -> Analyze
  -> Review Character/Storyboard
  -> Generate Images
  -> Generate Narration
  -> Render MP4
  -> Preview/Download
```

## Explicitly not required before Internal MVP

Do not block the MVP on:

- multiple LLM providers;
- multi-provider routing/optimization;
- BYOK;
- LoRA/adapter character training;
- advanced billing UI;
- collaboration/sharing;
- CapCut-style timeline editor;
- cinematic lip-sync;
- advanced Shorts editor;
- email/web-push notifications;
- microservice extraction;
- multi-region/GPU orchestration;
- full V1.8 production safety/operations gates.

These remain roadmap items and production gates, not prerequisites for proving the core NarrativeX product loop.

## V1.8 production scope

1. **Durable core:** Google OIDC/email-password, current server-session + CSRF auth contract, ownership, StoryVersion, Chapter snapshot, semantic scene/beat planning, CharacterVersion lock, Outfit/Project Bible, image/TTS/subtitle/FFmpeg and FinalArtifact validation. JWT/accessToken/refreshToken migration is scope riêng về sau.
2. **Creator control:** review grid, batch approve/reject/regenerate, prompt inspector, animatic, chapter/incremental render, ShortCandidate/ShortClip.
3. **Cost and operations:** OperationPlan, affected scope, asset reuse, estimate range/confidence/ETA, CostReservation, max spend, dynamic re-estimation, usage ledger, resource accounting.
4. **Reliability:** durable ProviderOperation reservation/UNKNOWN reconciliation, retry caps, resource scheduler, per-user fairness, provider rate limit/circuit breaker, lease/watchdog, atomic finalization, error catalog.
5. **Product platform:** aspect/quality settings, output profiles, notification/outbox, plan entitlement, watermark/exports/concurrency, optimistic locking/409 UX, i18n baseline.
6. **Trust & Safety:** input/output moderation, copyright report/review/takedown handling without a blanket per-story rights-attestation gate, prompt-injection defense, real-person consent/identity privacy, account abuse limiting, AI audit, deletion lifecycle.
7. **Provider path:** Vertex AI Gemini adapter via ADC/workload identity; VideoGenerationProvider/MotionAsset contract can evolve later and AI video only enables when quality/cost/safety gates pass.

## Historical progression

| Version | Delivered / planned capability |
|---|---|
| V1.1 | Style presets, Location/Outfit Bible, Identity QA nâng cao, auto merge/split, batch generation, prompt editor, usage dashboard. |
| V1.2 | AI video cho selected shots; Economy/Balanced/Cinematic mode. |
| V1.5 | Vertex Gemini production, dynamic operation cost, per-user accounting, delta/reuse, batch review, prompt inspector, animatic, watchdog/resiliency. |
| **V1.8** | **V1.8 architecture requirements, while retaining the V1.7 functional catalog: Trust & Safety, copyright report/review/takedown handling, consent/privacy, abuse protection, deletion lifecycle, AI audit, vi-VN/en-US i18n, entitlement, chapter continuation và selected-beat provider path.** |

## Next after V1.8

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
| Variable AI/media | Tính động qua OperationPlan theo duration, complexity, delta, reuse, provider/model/quality; production reserves before billable submission and reconciles after. |
| Self-hosted GPU | Capacity-driven, có gpu_seconds/max concurrency; chỉ bật khi benchmark chứng minh hợp lý. Managed-provider mode có thể scale GPU pool về 0. |

Không có giá cố định cho mỗi video hay quy tắc “1 giờ = 150 ảnh”. Visual budget là planner output; internal cost và billable cost được ghi riêng.

## Release blockers

- Chapter Analysis vertical slice chưa pass CI/E2E/real-provider verification.
- Dedicated ProviderOperation durability/`UNKNOWN` reconciliation chưa hoàn tất cho production-grade provider recovery.
- Public Character/Storyboard read/review contracts chưa có thì M1 chưa được coi là product-complete.
- P0/P1 security/safety chưa đóng, real-provider E2E chưa xác minh, hoặc prompt-injection test chưa pass.
- Password login/register đã có server-side Redis limiter; public beta vẫn bị block nếu broader account/session/route/resource-class/concurrent-job abuse controls, per-user attribution, entitlement hoặc spending cap chưa enforce server-side.
- Deletion/retention/real-person consent chưa chạy end-to-end.
- Backup/restore, FinalArtifact atomicity, UNKNOWN reconciliation hoặc audit còn mất dữ liệu.
- AI video chưa có benchmark hoặc fallback image-first/cost/safety chưa đạt thì feature phải tắt.
