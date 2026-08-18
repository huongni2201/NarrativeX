# V1.8 traceability and delivery status

This matrix distinguishes the attached V1.8 project specification from the implementation state in this repository. The attached specification defines the intended product/domain/architecture contract; current code, migrations, contracts and accepted ADRs define factual AS-IS claims. This file is a navigation and status aid, not a replacement specification.

| Source-of-truth area | Maintained repository reference | Current delivery status |
| --- | --- | --- |
| Product scope, actors, functional requirements | attached `NARRATIVEX_PROJECT_SPEC_V1_8.md`, `documentation/product/PRODUCT_SPEC.md`, `FEATURE_CATALOG.md` | V1.8 contract with the retained FR-01—FR-85 catalog; chapter continuation, control-plane features and production gates remain explicit |
| Business rules and state transitions | `documentation/domain/BUSINESS_RULES.md`, `DOMAIN_MODEL.md` | Documented; executable enforcement is incremental in the base project |
| Terms and stable domain codes | `documentation/domain/GLOSSARY.md` | Documented |
| System topology and deployment | `documentation/architecture/SYSTEM_ARCHITECTURE.md`, `TECHNOLOGY_STACK.md` | Documented |
| Data flow and service/module boundaries | `documentation/architecture/DATA_FLOW.md`, `SERVICE_BOUNDARIES.md` | Documented |
| Source layout and module responsibilities | `documentation/codebase/*`, `app/*/README.md` | Base project map is being completed with the code skeleton |
| Authentication, story-to-video and media workflows | `documentation/workflows/*` | Workflow references are maintained separately from code |
| Cross-cutting decisions | `documentation/decisions/ADR-*.md` | ADRs capture the modular monolith, durable provider-state, feature boundaries, cursor pagination and V1.8 control-plane choices |
| Backend ↔ worker payloads | `contracts/*` | Versioned v1 job-event schema added; integration tests remain a release gate |
| Local infrastructure | `docker-compose.yml`, root/module READMEs | PostgreSQL, Redis and MinIO local baseline |

## Deliberate non-claims

The base project is a runnable foundation, not a public-production implementation. Real Vertex/Gemini, image, TTS, Veo/Kling, Google OIDC, object-storage, moderation, billing, and email integrations require environment credentials and contract/E2E verification. A deterministic fake provider is suitable for tests only and must not be reported as production health.

Before public beta, the release gate must still prove ownership/authentication, account abuse limits before provider work, rights/consent, input/output moderation, prompt-injection fixtures, server-side entitlement, cost reservation/reconciliation, chapter resume/incremental scope, notification/outbox delivery, deletion lifecycle, backup/restore, observability, and no P0/P1 security or safety blockers.

## V1.8 implementation boundary

| V1.8 area | Repository evidence | Status |
|---|---|---|
| Project list/create and cursor pagination | Project controller/use cases, `CursorPage`, consolidated V1 baseline and frontend Query integration | IMPLEMENTED foundation |
| StoryVersion create with rights fields | Project story command, persistence and consolidated V1 rights columns | IMPLEMENTED foundation; read/update and full moderation flow pending |
| Analysis enqueue and job read | Generation controller/use cases, consolidated V1 persistence and v1 contract | IMPLEMENTED foundation; worker handoff/progress/reconciliation pending |
| Reusable character domain | Character/ProjectCharacter/version/appearance/outfit domain and persistence plus tests | IMPLEMENTED foundation; public REST contract pending |
| Chapter/storyboard model | Chapter/Scene/VisualBeat entities and persistence mapping | PARTIAL; public commands/API pending |
| Frontend runtime data mode | `data-mode.ts`, API default, fixture isolation for test/Storybook | IMPLEMENTED boundary; several API surfaces remain pending |
| AI worker | Typed provider-neutral schema/ports, untrusted-story boundary, disabled provider | PORT_ONLY; durable intake, lease, storage, media and real adapters pending |
| Safety/notification/entitlement/abuse/deletion | consolidated `V1__initial_schema.sql` control-plane section | Schema foundation; application executors remain pending |
