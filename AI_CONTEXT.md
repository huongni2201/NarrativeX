# NarrativeX AI coding context

NarrativeX is an image-first AI Story Video Studio. It turns flexible-length stories into a reviewed storyboard, consistent character/location/style visuals, narration/subtitles, optional selected-beat motion, and FFmpeg-rendered long-form or Short/Reel artifacts.

## Current repository shape

- `app/backend-service`: Spring Boot modular monolith; domain and durable orchestration authority.
- `app/ai-worker`: Python 3.12 AI/media worker; provider adapters, QA, TTS and FFmpeg boundary.
- `app/frontend-web`: Next.js + TypeScript UI; storyboard/review/cost/notification experience.
- `documentation`: canonical implementation-facing product, domain, architecture, workflow and codebase notes.
- `contracts`: versioned cross-runtime payload contracts.
- `docker-compose.yml`: local PostgreSQL/Redis plus backend/worker orchestration; durable media is Cloudflare R2.

## V1.11 priorities

The maintained baseline is `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`. Current priority is to finish the first durable creator loop while continuing persistence simplification:

- harden production user-audio upload/finalize/alignment;
- build narration-driven `VisualScenePlanner`;
- implement production image generation with durable immutable R2 media assets;
- render and validate the first `IMAGE_MOTION` MP4 path;
- preserve MyBatis-only production persistence with architecture and PostgreSQL integration tests;
- complete actual-cost reconciliation, moderation/SSRF/retention/observability/DR evidence as the production path matures.

Production persistence is MyBatis + explicit SQL across all backend features, including outbox enqueue/dispatch. JPA and direct `JdbcTemplate` persistence are absent from production code and guarded by architecture tests.

## Important constraints

Do not encode fixed duration or fixed image-count assumptions in code. Do not put provider credentials in the browser. Do not make a final artifact ready before MIME/dimension/checksum validation. Do not overwrite immutable history when regenerating.

Character model:
- Character = reusable User/Workspace-owned identity.
- ProjectCharacter = Character assignment within one Project.
- CharacterVersion = immutable identity snapshot.
- CharacterAppearance = story/timeline visual state.
- Scene/VisualBeat generation resolves only participating ProjectCharacters.
- Never duplicate Character solely for outfit/age/hairstyle/injury changes.
- Never use character name as a relational identity key.

Project Character list/detail screens now consume project-scoped authoritative backend read models. Do not reintroduce runtime demo/fabricated Character business data where the backend intentionally reports fields as unavailable.
