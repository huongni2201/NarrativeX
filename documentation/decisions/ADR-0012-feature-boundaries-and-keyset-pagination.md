# ADR-0012: Feature boundaries and keyset pagination

- Status: Accepted
- Date: 2026-08-18
- Supersedes package naming portions of: ADR-0011

## Context

The backend is a modular monolith intended to remain simple to operate now while preserving a practical path to extracting business capabilities into services later. The previous package root was named `modules`, several boundaries still allowed direct feature coupling, and the Project collection endpoint exposed offset/page-number pagination through Spring Data `Pageable` all the way into the application layer.

Large or frequently changing collections need stable pagination that does not become progressively more expensive as an offset grows. Application/domain code also should not depend on Spring Data pagination types.

## Decision

### 1. Package root

Rename the backend business package root from:

```text
com.narrativex.backend.modules
```

to:

```text
com.narrativex.backend.feature
```

The standard vertical slice remains:

```text
feature/<name>/
  api/
  application/
  domain/
  infrastructure/
```

`feature/common` remains a small shared kernel/cross-cutting feature.

### 2. Extraction-oriented dependency rules

- A business feature domain may import `feature/common` and its own feature only.
- A business feature domain may not import another business feature's domain.
- Cross-feature in-process application calls are exposed through `application.port.in` contracts.
- Infrastructure is responsible for adapting those contracts to HTTP/events/messages if a feature is extracted later.
- A controller belongs to the feature that owns the use case, not necessarily the resource name in the URL. Generation therefore owns the project analysis-job endpoint.
- Shared-looking business enums are not automatically moved into `common`. If two bounded contexts own the meaning independently, each feature owns its own value type.

### 3. Domain exceptions

`feature/common/domain/exception` defines only broad error categories:

- `DomainValidationException` -> invalid domain/request data;
- `DomainConflictException` -> valid request that conflicts with current business state.

Business-specific exceptions live under each feature's `domain/exception` and are thrown by the aggregate/entity that owns the invariant. The API exception handler maps categories to HTTP status without depending on feature-specific exception classes.

### 4. Cursor/keyset pagination

Collection endpoints use cursor/keyset pagination. Project listing is the first implementation and defines the common contract:

```text
GET /api/v1/projects?limit=<1..100>&cursor=<opaque optional cursor>
```

The result contains:

```text
content
nextCursor
limit
hasNext
```

The Project keyset is `(updated_at, id)` ordered descending. The query predicate after a cursor is logically:

```sql
updated_at < :updatedAt
OR (updated_at = :updatedAt AND id < :id)
```

Persistence fetches `limit + 1`, returns at most `limit`, and creates `nextCursor` from the last visible row when another row exists. The cursor is an opaque Base64URL token.

Spring Data `Page`/`Pageable` must not appear in application ports or queries. Infrastructure may use `PageRequest` only as a bounded row-limit mechanism; it must not expose offset/page-number semantics to the application.

### 5. Indexing

The Project list access pattern is backed by:

```sql
CREATE INDEX idx_projects_owner_updated_id
    ON projects (owner_id, updated_at DESC, id DESC);
```

## Consequences

### Positive

- Feature packages are vertically owned and easier to extract.
- Domain-to-domain feature coupling becomes an architecture-test failure.
- Project no longer directly owns/calls Generation API behavior.
- List pagination avoids growing offset scans and count queries.
- Application ports remain framework independent.
- Domain failures communicate business intent rather than generic `IllegalStateException`.

### Trade-offs

- Cursor pagination does not expose arbitrary page numbers or total page counts.
- A cursor is tied to the chosen ordering and should be treated as opaque by clients.
- Some value types may intentionally be duplicated across bounded contexts.
- This does not make NarrativeX a distributed microservice system today; it makes the modular monolith boundaries extraction-oriented.

## Verification

- `ArchitectureRulesTest` enforces the new package root and domain boundary rules.
- Backend/frontend contract tests are updated for cursor pagination.
- GitHub Actions are the merge gate for Maven, frontend lint/type-check/build, and worker checks.
