# NarrativeX Service and Module Boundaries

NarrativeX is one deployable Spring Boot modular monolith plus one separately deployed Python worker. Feature boundaries express ownership and dependency direction; they are not microservices.

## Current concrete Spring features

The current backend source contains concrete feature slices for:

```text
account
auth
character
common
generation
health
notification
project
storyboard
```

Do not describe `account` or `notification` as future-only slices; they exist in the current repository.

## Ownership summary

| Feature | Current responsibility |
|---|---|
| `account` | current-user/account-facing read concerns such as quota surfaces where implemented |
| `auth` | password/OIDC identity, session/CSRF and authentication entry concerns |
| `project` | Project/StoryVersion lifecycle, ownership and project-scoped read contracts |
| `character` | reusable Character identity, ProjectCharacter, CharacterVersion and related continuity state |
| `storyboard` | Chapter, Scene and VisualBeat business state/review boundaries |
| `generation` | OperationPlan, GenerationJob, StageAttempt, ProviderOperation and durable orchestration state |
| `notification` | persisted notification read/mark-read foundations |
| `health` | runtime/provider/configuration diagnostics |
| `common` | small cross-cutting primitives and API/error helpers; no business-policy dumping ground |

Asset/render/shorts and broader billing/provider/safety capabilities remain domain/target ownership concepts until concrete slices are established or expanded.

## Storyboard aggregate ownership

```text
project feature
  StoryVersion
      |
      v
storyboard feature
  Chapter (aggregate root)
      |
      v
  Scene (aggregate root)
      |
      v
  VisualBeat (child entity)
```

Chapter and Scene are independent aggregate roots. Relational foreign keys do not force a single aggregate boundary.

Analysis-time continuity additionally persists project Character/Location identity mappings and Scene relations. These cross-record materialization operations belong to the durable worker/application orchestration boundary; domain aggregates still do not call providers or repositories directly.

## Worker boundary

The Python worker owns execution mechanics, not product authority. It may:

- claim/lease/heartbeat persisted work;
- invoke provider ports;
- persist/reconcile ProviderOperation state;
- validate structured provider output;
- materialize analysis continuity/storyboard state under snapshot/lease guards;
- later execute image/TTS/render stages when those capabilities land.

It must not authorize browser users, decide product entitlement, own public HTTP APIs, own Flyway migrations or invent jobs from model output.

## Dependency direction

```text
API adapters -> application use cases -> domain
application -> outbound ports
infrastructure -> application/domain contracts
worker -> durable execution contract + provider/storage adapters
```

Rules:

- Domain packages do not import Spring/JPA/Redis/provider/storage/worker runtime dependencies.
- Application code does not expose transport DTOs as domain results.
- Cross-feature calls use explicit application contracts/stable IDs rather than reaching into another feature's repository.
- `common` remains intentionally small.
- Provider/vendor branches stay in adapters, not business domain code.

## Provider boundary

Current Chapter analysis has a durable provider lifecycle foundation:

```text
RESERVED -> SUBMITTED -> RUNNING/COMPLETED/FAILED
ambiguity -> UNKNOWN -> reconcile
```

Future image/video/TTS providers must reuse this durability principle rather than inventing direct SDK calls from feature/application/domain code.

## External system ownership

| System | NarrativeX owns | External system owns |
|---|---|---|
| Google OIDC | local identity/session/authorization mapping | Google authentication |
| AI/media providers | durable request/operation state, policy and reconciliation | provider execution |
| PostgreSQL | schema/contracts and canonical state | database mechanics |
| Redis | session namespace and transient delivery/counters | in-memory mechanics |
| Cloudflare R2 | storage keys/metadata/validation/lifecycle contract and access policy | durable object-storage mechanics |
| Email/push | notification intent/state | channel delivery outcome |

## Architecture enforcement

Backend architecture tests protect package/dependency direction, including the independent Chapter/Scene aggregate classification. These tests are part of `clean verify` and should be extended whenever a new concrete feature slice or cross-feature rule is introduced.
