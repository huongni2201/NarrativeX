# NarrativeX Technology Stack — V1.11

Canonical authority: [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md).

| Layer | Current stack | V1.11 role |
|---|---|---|
| Web | Next.js 16, React 19, TypeScript, TanStack Query, Zustand | Studio UI and review workflows |
| Backend | Java 25, Spring Boot 4.1, Security/OAuth2, Spring Session Redis, Actuator | modular monolith, policy, durable orchestration, MediaPlan authority |
| Persistence | PostgreSQL 18 target, Flyway, MyBatis + remaining migration-era JPA/JDBC | authoritative state; explicit SQL/CAS direction |
| Redis | Spring Data Redis + Spring Session Redis | sessions and transient hints only |
| Worker | Python 3.12+, Pydantic, HTTPX, asyncpg, google-auth, boto3 | async provider/media execution, alignment, reconciliation, FFmpeg workspace |
| AI | Vertex Gemini analysis adapter + provider-neutral ports | structured Chapter analysis |
| Narration | Google TTS foundation + user-provided audio timeline/alignment contracts | two narration strategies feeding one timeline model |
| Storage | Cloudflare R2 only | durable private media; PostgreSQL owns metadata/lineage |
| Media | FFmpeg-oriented deterministic render foundation; Wan-compatible I2V adapter foundation | first complete target is IMAGE_MOTION, I2V fast-follow |

## Persistence status

MyBatis-backed production boundaries include:

- ProviderOperation;
- Chapter;
- Project command/query persistence.

Next migration priority starts with StoryVersion, then high-concurrency generation/outbox/quota paths. Do not deepen JPA/JDBC for new persistence-heavy features without a documented exception.

## Narration status

Full-chapter TTS and R2-backed narration/alignment foundations are implemented. `NarrationStrategy.USER_PROVIDED_AUDIO` is also implemented as a planning/timeline foundation: ordered variable-count parts, fingerprints, global timeline mapping, alignment status and TTS-bypass operation planning.

Production upload/finalize and real alignment integration still require hardening before claiming the complete user-facing uploaded-audio workflow.

## Durable media rule

R2 is the only durable media store. Worker-local files are scratch/cache only. A provider URL or local path is never an authoritative asset reference.
