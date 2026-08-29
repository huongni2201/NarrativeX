# NarrativeX AI coding context

NarrativeX is a desktop-first AI-assisted story-video studio. The current product is guest-first, Chapter-first, review-first, audio-timeline-first and local-media-first.

## Repository boundaries

- `app/desktop`: only supported editor; Electron main owns native filesystem, ProjectStorage, Chrome/CDP web-provider automation and FFmpeg/ffprobe final rendering.
- `app/backend-service`: authoritative auth/ownership, domain metadata, policy, admission, durable jobs, leases and Flyway schema.
- `app/ai-worker`: asynchronous analysis, narration, image generation and media-validation workers.
- `packages/client-contracts`: shared Desktop/backend contracts.
- `contracts`: backend ↔ worker payloads.

## Authority model

```text
PostgreSQL
  -> durable auth / ownership / domain / policy / job / lease / artifact metadata

Electron main
  -> local project bytes / project.manifest.json
  -> native files and protected device credentials
  -> Gemini Web browser automation
  -> FFmpeg/ffprobe final project rendering

Electron renderer
  -> UI / routing / query cache / editor drafts

Python workers
  -> backend-authorized analysis / image / narration / validation work
```

The renderer is never a second domain authority and never receives unrestricted Node.js access.

## Authentication

Desktop starts with a stable installation-scoped guest identity. Google is the only account sign-in provider. Provider/account actions remain backend-gated and can trigger an in-context Google OIDC flow without losing the active editor route.

Never reintroduce password login/register/forgot-password flows. Keep guest installation secret, signed-in user session and local-execution device credential separate.

## Chapter source

`chapters.source_text` and `chapters.source_hash` are the authoritative saved Chapter source. Analyze and narration consume that saved Chapter directly. Do not reintroduce translation/content-variant lineage unless product direction explicitly changes.

## Project-media storage

```text
Generated images                -> project-local media -> Desktop ProjectStorage
Generated narration             -> project-local media -> Desktop ProjectStorage
Imported image/audio/video      -> Desktop ProjectStorage
Render work/cache               -> Desktop project work storage
Final MP4                       -> Desktop project artifacts
Voice reference/custom voice    -> R2 when account-scoped remote storage is required
Metadata                        -> PostgreSQL
```

R2 is **voice-reference/custom-voice storage only** in the current runtime. Do not route generated project images, generated narration or final video through R2.

Absolute machine paths never become backend identities. `project.manifest.json` maps stable IDs to relative paths plus size/SHA-256.

## VIDEO and web generation

`VisualGenerationMode` intentionally supports both `IMAGE` and `VIDEO`.

- Keep the VIDEO option in Analyze Chapter and its persisted analysis preference.
- Keep web/browser-based video-generation logic and contracts.
- Do not equate VIDEO intent with the removed Python/Wan I2V runtime.
- Python worker roles remain `analysis`, `narration`, `media-validation`, `image-generation`.

## Rendering

Final project rendering is one path only:

```text
backend assigns paired Desktop
  -> Desktop claim/lease
  -> local preflight + checksum resolution
  -> FFmpeg/ffprobe
  -> local final MP4
  -> backend artifact metadata only
```

There is no cloud/server final-render executor, no chapter-render worker pipeline and no remote final-video fallback.

## Database

Production persistence is MyBatis + explicit PostgreSQL SQL. NarrativeX is pre-production, so Flyway is maintained as a clean V1–V8 baseline. Recreate disposable development/test databases when the baseline changes. After the first production deployment, applied migrations become immutable and future changes are append-only.

## Product rules

- Preserve Chapter → Scene → VisualBeat semantics.
- Narration timing is the master clock.
- A beat may use image or video media.
- Image camera/motion controls must not be forced onto video beats.
- Do not encode fixed image counts or durations.
- Do not silently replace approved/versioned state.
- Workers/Desktop executors may not invent paid work outside backend-authorized plans.

Use `documentation/product/ROADMAP.md` for active remaining work. Completed migration plans are historical evidence, not current architecture.
