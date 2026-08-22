# NarrativeX Technology Stack — V1.11

Canonical authority: [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md). Accepted ADRs refine cross-cutting decisions; ADR-0016 supersedes the R2-only rule for final rendered MP4 storage.

| Layer | Current stack | V1.11 role |
|---|---|---|
| Web | Next.js 16, React 19, TypeScript, TanStack Query, Zustand | Studio UI and review workflows |
| Backend | Java 25, Spring Boot 4.1, Security/OAuth2, Spring Session Redis, Actuator | modular monolith, policy, durable orchestration, MediaPlan authority |
| Persistence | PostgreSQL 18 target, Flyway, MyBatis + explicit SQL | sole production persistence path; explicit SQL/CAS |
| Redis | Spring Data Redis + Spring Session Redis | sessions and transient hints only |
| Worker | Python 3.12+, Pydantic, HTTPX, asyncpg, google-auth, boto3 | async provider/media execution, alignment, reconciliation, FFmpeg workspace |
| AI | Vertex Gemini analysis adapter + provider-neutral ports | structured Chapter analysis |
| Narration | Google TTS + local VieNeu-TTS v3 Turbo adapter + user-provided audio timeline/alignment contracts | two narration strategies feeding one timeline model; VieNeu supports configured instant voice cloning |
| Pipeline storage | Cloudflare R2 | durable private source/generated/reusable media; PostgreSQL owns metadata/lineage |
| Final video storage | Google Drive behind `FinalVideoStorage` | durable private final rendered MP4 exports; resumable upload + verification before READY |
| Media | FFmpeg-oriented deterministic render foundation; Wan-compatible I2V adapter foundation | first complete target is IMAGE_MOTION, I2V fast-follow |

## Persistence status

MyBatis/explicit-SQL production boundaries include:

- ProviderOperation;
- Chapter;
- Project command/query persistence;
- GenerationJob;
- StageAttempt;
- OperationPlan;
- MediaPlan;
- generation outbox enqueue persistence;
- Job History;
- Chapter Analyze durable admission and enqueue.

The outbox dispatcher uses a dedicated MyBatis mapper for claim/lease operations.

The migration is complete. The backend build has no JPA dependency and production source has no `JdbcTemplate`; architecture and PostgreSQL integration tests prevent regression.

## Narration status

Full-chapter TTS and R2-backed narration/alignment foundations are implemented. `NarrationStrategy.USER_PROVIDED_AUDIO` is also implemented as a planning/timeline foundation: ordered variable-count parts, fingerprints, global timeline mapping, alignment status and TTS-bypass operation planning.

Production upload/finalize and real alignment integration still require hardening before claiming the complete user-facing uploaded-audio workflow.

## Frontend data authority

Project Character list/detail screens now consume project-scoped backend read models for role, importance, aliases/groups, pinned version, appearance and scene count. Runtime UI must leave unsupported fields unavailable instead of substituting fabricated business data.

## Durable media rules

R2 is the durable store for source/generated/reusable media. Final rendered MP4 exports use Google Drive through a provider-neutral `FinalVideoStorage` boundary. Worker-local files are scratch/cache/render workspace only. A provider URL or local path is never an authoritative durable asset reference.

A final video follows:

```text
FFmpeg local final.mp4
  -> validate
  -> Google Drive resumable upload
  -> verify
  -> PostgreSQL FinalArtifact storage metadata
  -> READY
  -> local cleanup
```

Upload failure retries the upload boundary and does not rerender a valid local final MP4.
