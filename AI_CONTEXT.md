# NarrativeX AI coding context

NarrativeX is an image-first AI Story Video Studio. It turns flexible-length stories into a reviewed storyboard, consistent character/location/style visuals, narration/subtitles, optional selected-beat motion, and FFmpeg-rendered long-form or Short/Reel artifacts.

## Current repository shape

- `app/backend-service`: Spring Boot modular monolith; domain and durable orchestration authority.
- `app/ai-worker`: Python 3.12 AI/media worker; provider adapters, QA, TTS and FFmpeg boundary.
- `app/frontend-web`: Next.js + TypeScript UI; storyboard/review/cost/notification experience.
- `documentation`: canonical implementation-facing product, domain, architecture, workflow and codebase notes.
- `contracts`: versioned cross-runtime payload contracts.
- `infrastructure`: local/deployment support; `docker-compose.yml` provides local dependencies.

## V1.8 priorities

Durable jobs and provider reconciliation, adaptive visual planning, CharacterVersion/OutfitVersion snapshots, OperationPlan and cost reservation, account abuse throttling before paid work, entitlement enforcement, trust & safety, privacy/deletion, notification outbox, optimistic locking, and production backup/restore readiness.

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
