# NarrativeX Technology Stack

This page records the current repository stack and its V1.10 role. Canonical authority: [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md).

## Application stack

| Layer | Current repository evidence | Role |
|---|---|---|
| Web | Next.js `^16.3.1`, React `^19.2.8`, TypeScript `^5.8.2`, TanStack Query `^5.101.4`, Zustand `^5.0.15`, Node.js 22 | Project/Chapter UI and review workflows |
| Backend | Java 25, Spring Boot 4.1.0, JPA, Security/OAuth2, Spring Session Redis, Actuator, PDFBox 3.0.8 | Modular monolith, ownership, durable orchestration and admission controls |
| Persistence | PostgreSQL 18 target, Flyway, Spring Data JPA | Authoritative domain/job/quota/safety state |
| Redis | Spring Data Redis + Spring Session Redis | Session storage plus non-authoritative delivery/progress hints |
| Worker | Python >=3.12, Pydantic, HTTPX, asyncpg, google-auth, Pytest/Ruff/mypy | Async AI execution, provider reconciliation and materialization |
| AI | Vertex AI Gemini adapter; provider ports; safe default `provider_mode=disabled` | Structured Chapter analysis |
| Storage/media | MinIO/S3-compatible storage and FFmpeg-oriented media foundations | Future image/audio/video artifacts and render/export |

## Flyway baseline

The maintained development chain is:

- V1 `initial_schema`
- V2 `seed_demo_data`
- V3 `split_visual_beat_motion_fields`
- V4 `durable_provider_operations_and_admission_limits`
- V5 `harden_generation_execution_constraints`

V4 links OperationPlan to GenerationJob, adds ProviderOperation request fingerprint/status constraints and adds plan monthly credits. Released migration history must remain forward-only.

## Durable Chapter Analyze

```text
persisted Chapter
  -> safety / entitlement / quota / cost admission
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> commit
  -> best-effort Redis hint
  -> worker claim/lease/heartbeat
  -> ProviderOperation RESERVED before external submit
  -> SUBMITTED/RUNNING/COMPLETED | FAILED | UNKNOWN
  -> UNKNOWN reconciliation
  -> transactional result materialization
```

PostgreSQL is authoritative. Redis is not the source of truth for GenerationJob execution.

Current admission checks the latest persisted Chapter safety decision, `storyAnalysis` entitlement, concurrent expensive-job capacity and monthly credits, then reserves usage atomically in PostgreSQL. OperationPlan stores non-zero estimate/cap values for Chapter Analyze. Full actual-usage reconciliation and unused-reservation release remain follow-up work.

## Worker runtime

- `WORKER_CONCURRENCY` defaults to 4 and is bounded to 1..32.
- Claims use PostgreSQL `FOR UPDATE ... SKIP LOCKED` plus StageAttempt leases/heartbeats.
- asyncpg pool sizing follows configured concurrency.
- Graceful shutdown stops new claims and waits for in-flight jobs.
- Character/Scene/VisualBeat writes are batched where practical.

## Chapter import

Backend batch import supports `.txt`, `.docx` and `.pdf`; PDF extraction uses Apache PDFBox.

## Frontend runtime

- Next.js App Router owns navigation.
- TanStack Query owns persisted server state.
- URL/search params own navigable filters.
- Zustand is reserved for transient editor/wizard state.
- API mode does not silently substitute fixture data.
- Frontend CI runs `npm ci`, `npm test`, `npm run lint`, `npm run type-check`, `npm run build` on Node.js 22.

## Authentication

Browser auth uses Spring Security server sessions + CSRF with Spring Session Redis. Password login/register and Google OIDC are supported. JWT access/refresh tokens are not the current browser contract.

## Remaining implementation gaps

- AI Location materialization.
- Scene -> ProjectCharacter relation materialization.
- Scene -> Location relation materialization.
- Explicit approved-storyboard reset/versioning.
- Complete actual-cost/usage reconciliation.
- Image generation, TTS/subtitles, render/export and FinalArtifact validation.
- Broader production moderation/consent/abuse coverage, observability and DR evidence.
