# NarrativeX Technology Stack — V1.11

Canonical authority: [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md). ADR-0003 governs R2 pipeline media and Google Drive final rendered MP4 storage.

| Layer | Current stack | V1.11 role |
|---|---|---|
| Web | Next.js 16, React 19, TypeScript, TanStack Query, Zustand | Studio UI and review workflows |
| Desktop | Electron, Electron Vite, React, TypeScript, Lucide | Primary editor workspace migration target; secure preload boundary for local execution |
| Backend | Java 25, Spring Boot 4.1, Security/OAuth2, Spring Session Redis, Actuator | modular monolith, policy, durable orchestration, MediaPlan authority |
| Persistence | PostgreSQL 18 target, Flyway, MyBatis + explicit SQL | sole production persistence path |
| Redis | Spring Data Redis + Spring Session Redis | sessions and transient hints only |
| Worker | Python 3.12+, Pydantic, HTTPX, asyncpg, google-auth, boto3 | async provider/media execution, narration, image generation, FFmpeg render, storage adapters |
| AI analysis | Vertex Gemini | structured Chapter analysis |
| Image generation | Vertex Gemini image execution | real production foundation; validated image outputs persist to R2 |
| Narration | Google TTS + local VieNeu + uploaded-audio timeline/alignment contracts | generated narration is R2-backed; uploaded-audio E2E remains partial |
| Pipeline storage | Cloudflare R2 | durable private source/generated/reusable media |
| Final video storage | Google Drive | durable private final MP4 through resumable upload and provider-aware FinalArtifact metadata |
| Deterministic render | FFmpeg + ffprobe | `IMAGE_MOTION` chapter render is implemented foundation |
| Optional I2V | Wan-compatible adapter foundation | deferred fast-follow/hardening |

## Desktop client boundary

`app/desktop` is the primary editor client and a sibling to `app/frontend-web`. It implements the
dark editor shell, backend timeline/resource reads, production render request and job polling. Its
main/preload boundary is the future home for system-browser Google OAuth callbacks, safeStorage,
local device heartbeat, cache and FFmpeg execution. The renderer must not become an alternative
source of truth for Projects, Chapters, Scenes, VisualBeats, assets, entitlements or render progress.

Electron main/preload code is the future home for local device, cache and FFmpeg execution protocols. Renderer code receives only explicitly exposed capabilities through the preload bridge.

## Persistence status

Production persistence uses MyBatis + explicit SQL. The backend build has no JPA dependency and production source has no direct `JdbcTemplate` persistence.

## Narration status

Generated narration through Google TTS/local VieNeu is implemented as an R2-backed foundation. `USER_PROVIDED_AUDIO` planning supports ordered variable-count parts, fingerprints, a logical global clock and TTS bypass.

The current render worker loads generated narration matching the pinned Chapter source identity. It does not yet slice/stitch aligned multi-part uploaded narration into chapter-local render input.

## Image/render status

The worker now has real Vertex image generation and deterministic IMAGE_MOTION render foundations:

```text
Vertex image output
  -> validate
  -> R2 image MediaAsset
  -> CHAPTER_RENDER
  -> FFmpeg IMAGE_MOTION
  -> ffprobe/checksum
  -> Google Drive final MP4
```

Do not describe production image generation, deterministic chapter rendering or Google Drive final-video storage as future-only capabilities.

## Durable media rules

```text
Images / narration / accepted uploaded audio / reusable media -> R2
Final rendered MP4                                       -> Google Drive
Metadata / provider identity / lineage                   -> PostgreSQL
Worker-local files                                       -> ephemeral scratch
```

The final Drive object is identified by provider metadata/file ID, not by a public URL.

## Drive retry behavior

Drive upload is resumable within one worker attempt. The adapter also looks up an existing final file by render fingerprint before creating another object.

The local rendered MP4 currently lives in an ephemeral job workspace. If an attempt exits after a Drive failure, a later reclaimed job may rerender. Cross-attempt upload-only retry without rerender is therefore a target hardening item rather than a current guarantee.
