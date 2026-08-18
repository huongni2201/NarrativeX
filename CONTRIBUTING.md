# Contributing to NarrativeX

## Before opening a change

1. Read `AGENTS.md` and the relevant document under `documentation/`.
2. Confirm the change against the V1.8 project specification and the current code/ADR baseline.
3. Keep the write scope focused and preserve unrelated worktree changes.
4. Add tests for new business rules, state transitions, contracts, or security boundaries.

## Local checks

```powershell
# Backend
cd app/backend-service
./mvnw.cmd test

# Worker
cd ../ai-worker
python -m pytest
python -m ruff check .
python -m mypy src

# Frontend
cd ../frontend-web
npm ci
npm run lint
npm run type-check
npm run build
```

The first run may require dependency downloads. Provider integrations must use deterministic fakes or mocked adapters in automated tests.

## Documentation changes

Update the smallest relevant document. Use stable domain codes and terms, and record cross-cutting architecture changes in `documentation/decisions/`. Keep product behavior, security controls, cost policy, and operational assumptions explicit rather than hiding them in UI copy.

## Pull request checklist

- [ ] Tests and type/lint checks pass for changed modules.
- [ ] No secrets, provider keys, personal data, or production endpoints were added.
- [ ] Migrations are backward-compatible or include a documented rollout plan.
- [ ] Idempotency, retry/UNKNOWN behavior, ownership, and optimistic-lock behavior are covered where relevant.
- [ ] Documentation and contract versions match the implementation.
