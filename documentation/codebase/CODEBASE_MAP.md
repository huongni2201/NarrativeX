# NarrativeX W1-D1 Codebase Map

## Audit scope and status

- Audit: NX-W1-D1, 2026-08-17.
- Status: `PARTIAL`. The repository was mapped and native checks were run, but a fresh PostgreSQL startup fails schema validation and frontend checks were blocked by a locked `node_modules` binary.
- Initial Git state: branch `main`, HEAD `d6760188130814c7e4654c4bdc391472e05d338c`, dirty before the audit with frontend/documentation changes. The audit preserved them.
- “Target” below is a later integration shape, not a claim that the target capability already exists.

## Repository layout

```text
app/backend-service/   Spring Boot modular monolith: API, DDD modules, persistence adapters, Flyway, security
app/frontend-web/      Next.js App Router / React / TypeScript studio UI
app/ai-worker/         Python 3.12 worker foundation and provider ports
contracts/             versioned backend-to-worker JSON schema
docker-compose.yml     local PostgreSQL, Redis and MinIO dependencies only
documentation/         architecture, domain, workflows, plans, ADRs and audit outputs
infrastructure/        local/production guardrail notes; no deployment manifests
scripts/               README only; no executable verification script
```

## Runtime architecture

```mermaid
flowchart LR
  FE[Next.js studio UI] -->|HTTP JSON, credentials include| BE[Spring Boot API]
  BE --> PG[(PostgreSQL 16)]
  BE -. configured, no current call sites .-> R[(Redis 7)]
  BE -. target binary boundary .-> S[(MinIO / S3)]
  BE -. target delivery contract .-> W[Python worker]
  W -. target provider ports .-> P[External AI/media providers]
```

Current reality: the only verified runtime path that reaches PostgreSQL is the backend. The worker does not consume a durable queue or call the backend, and visible frontend screens do not use the API client except for the unreachable legacy `StudioDashboard.createProject` path.

## Backend modules (current)

| Module | Current responsibility | Runtime status |
|---|---|---|
| `project` | Project aggregate, story-version use cases, commands, ports and JPA adapters | real API/persistence; incomplete CRUD |
| `character` | Reusable Character identity, ProjectCharacter assignments, CharacterVersion lock lifecycle, appearance/outfit state and JPA adapters | domain/application/persistence slice; no HTTP API yet |
| `generation` | GenerationJob/OperationPlan aggregates, enqueue/read use cases, ports and JPA adapters | real persistence scaffold; no worker execution |
| `storyboard` | framework-free chapter/scene/visual-beat models plus JPA mappings | persistence mapping only; no controller/use-case API |
| `health` | provider configuration status response | diagnostic/configuration only, not a provider health probe |
| `shared.api` | Spring `ProblemDetail` handlers for validation and `IllegalArgumentException` | partial error contract |
| `configuration` | limits and conditional OIDC/local security chain | local mode open by default; not production safe |

## Frontend routes and visible features (current)

| Route | Visible surface | Current state |
|---|---|---|
| `/` | overview, project workspace, characters, wizard modals | Zustand-driven shell; mostly mock/local |
| `/auth` | login/register form and Google button | visual/local-only login; no backend auth call |
| `/dashboard` | delegates to `/` shell | same as root; no route-param project loading |
| `/characters` | character library | mock data and local modal state |
| sidebar `assets` / `presets` | controls exist in current worktree | no render branch in `app/page.tsx`; dead/unreachable until wired |
| production views | chapters, workspace, storyboard, visual review, render, preview | mock production store; local transitions and timers |

## Worker architecture (current)

- Entrypoint: `python -m narrativex_worker` and `narrativex-worker` console script.
- `NarrativeXWorker` handles logging, dry-run and process cancellation; non-dry-run is an idle loop.
- `WorkerService` enforces rights attestation, builds a prompt with an explicit untrusted-story boundary, then calls a provider port.
- `DisabledProvider` fails closed; no real provider SDK, queue client, object-storage client, database client, lease, heartbeat, cancellation protocol or reconciliation loop is implemented.
- The worker is therefore `PORT_ONLY` plus a safe disabled adapter, not an integrated production worker.

## Database ownership and schema

- Backend owns the Flyway files and JPA mappings.
- PostgreSQL is intended to be authoritative; Redis has no current application call sites.
- V1 creates only `schema_baseline`; V2 creates the initial domain tables; V3 adds control-plane tables/columns; V4 adds reusable character identity, immutable versions, appearances, outfits and project assignments.
- A clean PostgreSQL database currently has zero tables after the application startup attempt: Flyway history was not present and Hibernate validation stopped at missing `chapters`. See `documentation/audits/evidence/W1-D1_COMMAND_EVIDENCE.md`.
- Binary storage is only described in documentation/Compose; no backend or worker object-storage adapter is present.

## Redis usage

`spring-boot-starter-data-redis` and connection properties are present, but `rg` found no `RedisTemplate`, `StringRedisTemplate`, queue, stream, pub/sub, lock or progress implementation. Current classification is `UNUSED_CONFIGURED_DEPENDENCY`, not business state.

## Current vs target

| Capability | Current | Target needed for Week 2 |
|---|---|---|
| Project list/create | Backend real; visible UI reads mock store | API-backed query and mutation with server identity |
| Story persistence | POST-only backend; visible wizard local | create/read/update story with version/If-Match semantics |
| Upload | UI placeholder/mock | upload intent, object-store upload, completion/validation |
| Async analysis | job/operation rows are inserted with zero estimate | reservation, idempotency, queue delivery, worker claim and recovery |
| Progress | fake interval/local store | persisted job read plus SSE/replayable event path |
| Auth/ownership | conditional OIDC scaffold and client-supplied local ID | fail-closed auth, workspace membership and server-side ownership |
| Media assets | UI mocks and remote sample images | private object storage, immutable asset metadata and access checks |

## Critical dependency graph

```text
FE visible action
  -> Zustand/local mock or (only legacy StudioDashboard) api.ts
  -> existing /api/v1 project/story/job endpoints
  -> application outbound port
  -> infrastructure persistence adapter
  -> Spring Data JPA repository/JPA entity
  -> PostgreSQL (currently cannot start from empty DB)

Future async path:
  backend operation plan/reservation/job
  -> durable delivery hint / contract
  -> worker claim + lease + provider operation reservation
  -> provider adapter / media storage
  -> backend state transition + event/outbox
  -> FE polling/SSE
```

## Existing decisions validated

The audit found no architectural decision that should change in D1. Existing ADR-0001 (modular monolith plus worker) and ADR-0002 (PostgreSQL authoritative state plus durable provider operations) remain the correct target constraints; the findings document incomplete implementation against them.
