# Contributing to NarrativeX

## Before opening a change

1. Read `AGENTS.md` and the relevant document under `docs/`.
2. Confirm the change against current migration status, accepted ADRs and current code. For factual AS-IS behavior, current code/migrations/tests outrank stale derived documentation.
3. Treat `app/desktop` as the only editor client. Do not introduce a browser frontend or browser-only product architecture unless a new ADR explicitly reopens that decision.
4. Keep the write scope focused and preserve unrelated worktree changes.
5. Add tests for new business rules, state transitions, contracts, security boundaries, local-storage invariants or execution lifecycle changes.

## Local checks

Before pushing or merging, run every check below for each module you changed. CI (`.github/workflows/ci.yml`) runs the same commands.

Per-module commands:

```powershell
# Backend
cd app/backend-service
./mvnw.cmd test

# Use a separate output directory when an IDE also compiles into target/:
./mvnw.cmd test '-Dnarrativex.buildDirectory=target/verification/target'

# Generation service
cd ../generation-service
python -m pytest
python -m ruff check .
python -m mypy src

# Desktop
cd ../desktop
npm ci
npm test
npm run type-check
npm run build
```

Provider integrations must use deterministic fakes or mocked adapters in ordinary automated tests.

## Scope-specific rules

Read `AGENTS.md` for domain, Desktop, storage and runtime verification rules. Read `docs/current-status.md` before using older authentication or deployment instructions.

For docs-only changes, run `git diff --check` and verify edited local links. Code tests and runtime UI checks are required when implementation changes; prose-only updates do not require starting Electron.

For database changes, follow `docs/architecture/database.md`. Reset a database only when its data has explicitly been confirmed disposable.


## Documentation changes

Update the smallest relevant document, but update an ADR when a change crosses a client, storage, authentication, timing-authority or execution boundary. Keep `IMPLEMENTED`, `PARTIAL`, `TARGET` and `DEFERRED` distinct.

Use the [ADR index](docs/decisions/README.md) and [current migration status](docs/current-status.md). ADR-0001 defines application identity and Project ownership; ADR-0002 defines the backend/compute boundary and durable recovery semantics. Preserve earlier decisions as historical rationale only when explicitly marked as such.

## Pull request checklist

- [ ] Tests and type/lint/build checks pass for changed modules.
- [ ] `git diff --check` is clean and edited local links resolve when docs change.
- [ ] No secrets, provider keys, personal data, absolute local project paths or production credentials were added.
- [ ] Migrations are backward-compatible or include a documented rollout plan.
- [ ] Idempotency, retry/UNKNOWN behavior, ownership, lease loss and optimistic-lock behavior are covered where relevant.
- [ ] Desktop preload/main security boundaries remain narrow.
- [ ] Documentation and contract versions match the implementation.
