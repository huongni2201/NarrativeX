# v1.7 traceability and delivery status

This matrix distinguishes the attached project specification from the implementation work requested in this task. The v1.7 Markdown specification is the product/architecture source of truth; this file is a repository navigation and status aid, not a replacement specification.

| Source-of-truth area | Maintained repository reference | Current delivery status |
| --- | --- | --- |
| Product scope, actors, functional requirements | `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_7.md`, `documentation/product/PRODUCT_SPEC.md`, `FEATURE_CATALOG.md` | repository-local V1.7 authority with maintainable summaries; chapter continuation, control-plane features and production gates remain explicit |
| Business rules and state transitions | `documentation/domain/BUSINESS_RULES.md`, `DOMAIN_MODEL.md` | Documented; executable enforcement is incremental in the base project |
| Terms and stable domain codes | `documentation/domain/GLOSSARY.md` | Documented |
| System topology and deployment | `documentation/architecture/SYSTEM_ARCHITECTURE.md`, `TECHNOLOGY_STACK.md` | Documented |
| Data flow and service/module boundaries | `documentation/architecture/DATA_FLOW.md`, `SERVICE_BOUNDARIES.md` | Documented |
| Source layout and module responsibilities | `documentation/codebase/*`, `app/*/README.md` | Base project map is being completed with the code skeleton |
| Authentication, story-to-video and media workflows | `documentation/workflows/*` | Workflow references are maintained separately from code |
| Cross-cutting decisions | `documentation/decisions/ADR-*.md` | ADRs capture the modular monolith, durable provider-state and v1.7 control-plane choices |
| Backend ↔ worker payloads | `contracts/*` | Versioned v1 job-event schema added; integration tests remain a release gate |
| Local infrastructure | `docker-compose.yml`, `infrastructure/README.md` | PostgreSQL, Redis and MinIO local baseline added |

## Deliberate non-claims

The base project is a runnable foundation, not a public-production implementation. Real Vertex/Gemini, image, TTS, Veo/Kling, Google OIDC, object-storage, moderation, billing, and email integrations require environment credentials and contract/E2E verification. A deterministic fake provider is suitable for tests only and must not be reported as production health.

Before public beta, the release gate must still prove ownership/authentication, account abuse limits before provider work, rights/consent, input/output moderation, prompt-injection fixtures, server-side entitlement, cost reservation/reconciliation, chapter resume/incremental scope, notification/outbox delivery, deletion lifecycle, backup/restore, observability, and no P0/P1 security or safety blockers.

## v1.7 delta implemented in the foundation

| v1.7 delta | Repository evidence | Status |
|---|---|---|
| FR-79—FR-83 chapter continuation | Chapter foundation, worker job types, contract enum and documented affected-scope rules | Contract/foundation; full chapter commands remain pending |
| Rights policy version and basis | `StoryVersion` fields, configurable request defaults, V3 migration | Foundation implemented |
| Story limits as configuration | `NarrativeXLimitsProperties` and environment-backed `application.yml` settings | Foundation implemented |
| Safety/notification/entitlement/abuse/deletion persistence | `V3__v17_control_plane.sql` | Schema foundation; application executors remain pending |
| Cross-cutting decision record | `ADR-0003-v17-control-plane-and-chapter-continuation.md` | Documented |
